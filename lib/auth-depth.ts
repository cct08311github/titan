/**
 * Edge JWT verification for defense-in-depth auth — Issue #129
 *
 * Layer 1 (Edge): lightweight JWT check in middleware.ts using NEXTAUTH_SECRET.
 * Layer 2 (Node.js): existing withAuth / withManager wrappers on route handlers
 *   continue to validate the full DB-backed next-auth session. They are NOT removed.
 *
 * This module exports checkEdgeJwt(), which is called by middleware.ts for all
 * /api/* routes (except /api/auth/*). It extracts the JWT from:
 *   1. Authorization: Bearer <token> header
 *   2. next-auth.session-token cookie (both secure and plain variants)
 *
 * Returns null to allow the request to continue, or a 401 NextResponse to block.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { logger } from "@/lib/logger";

const SESSION_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

/**
 * Extracts the raw JWT string from the request.
 * Checks Authorization header first, then session cookies.
 */
function extractToken(req: NextRequest): string | null {
  // 1. Authorization: Bearer <token>
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim() || null;
  }

  // 2. next-auth session cookie
  const cookieHeader = req.headers.get("cookie") ?? "";
  for (const name of SESSION_COOKIE_NAMES) {
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  return null;
}

/**
 * Builds a Uint8Array secret from NEXTAUTH_SECRET for use with jose.
 */
function getSecretKey(): Uint8Array | null {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

/**
 * Performs a lightweight Edge-compatible JWT verification.
 *
 * @returns null   — JWT valid, allow request to continue
 * @returns NextResponse(401) — JWT missing, expired, or signature invalid
 */
export async function checkEdgeJwt(req: NextRequest): Promise<NextResponse | null> {
  const url = req.url;

  const secretKey = getSecretKey();
  if (!secretKey) {
    logger.warn({ url }, "[middleware] NEXTAUTH_SECRET not set — blocking request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = extractToken(req);
  if (!token) {
    logger.warn({ url }, "[middleware] blocked request — no JWT token present");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // next-auth v4 signs JWTs with HS256 using NEXTAUTH_SECRET
    await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
    return null; // valid — allow the request to continue
  } catch (err) {
    const code = (err as { code?: string }).code ?? "UNKNOWN";
    logger.warn(
      { url, code },
      "[middleware] blocked request — JWT verification failed"
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
