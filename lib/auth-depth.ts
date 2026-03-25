/**
 * Edge JWT verification for defense-in-depth auth — Issue #129
 *
 * Layer 1 (Edge): lightweight JWT check in middleware.ts using AUTH_SECRET.
 * Layer 2 (Node.js): existing withAuth / withManager wrappers on route handlers
 *   continue to validate the full DB-backed Auth.js session. They are NOT removed.
 *
 * This module exports checkEdgeJwt(), which is called by middleware.ts for all
 * /api/* routes (except /api/auth/*). It extracts the JWT from:
 *   1. Authorization: Bearer <token> header
 *   2. next-auth.session-token cookie (both secure and plain variants)
 *
 * Returns null to allow the request to continue, or a 401 NextResponse to block.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, jwtDecrypt } from "jose";
import { logger } from "@/lib/logger";

const SESSION_COOKIE_NAMES = [
  // Auth.js v5 cookie names
  "authjs.session-token",
  "__Secure-authjs.session-token",
  // Legacy next-auth v4 cookie names (transition period)
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
 * Default cookie name used by Auth.js v5 as HKDF salt.
 * Must match the sessionToken cookie name configured in auth.ts.
 */
const DEFAULT_SESSION_COOKIE = "authjs.session-token";

/**
 * Derives the encryption key from AUTH_SECRET.
 * Auth.js v5 uses HKDF to derive a 64-byte key from the secret
 * for JWE (A256CBC-HS512) encryption. For JWS fallback we use the raw secret.
 *
 * Verified against @auth/core/jwt.js getDerivedEncryptionKey():
 *   hkdf("sha256", secret, salt, `Auth.js Generated Encryption Key (${salt})`, 64)
 * where salt = cookie name (e.g. "authjs.session-token").
 */
async function getDerivedEncryptionKey(
  salt: string = DEFAULT_SESSION_COOKIE
): Promise<Uint8Array | null> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(secret), "HKDF", false, ["deriveBits"]
  );
  // Auth.js v5: HKDF SHA-256, salt=cookieName, info="Auth.js Generated Encryption Key ({cookieName})", 512 bits
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: enc.encode(salt),
      info: enc.encode(`Auth.js Generated Encryption Key (${salt})`),
    },
    keyMaterial,
    512 // 64 bytes for A256CBC-HS512
  );
  return new Uint8Array(derivedBits);
}

function getRawSecretKey(): Uint8Array | null {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
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

  const rawKey = getRawSecretKey();
  if (!rawKey) {
    logger.warn({ url }, "[middleware] AUTH_SECRET not set — blocking request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = extractToken(req);
  if (!token) {
    logger.warn({ url }, "[middleware] blocked request — no JWT token present");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // NextAuth v4 default: JWE with dir+A256GCM (encrypted, not signed).
    // Detect by checking the token header algorithm.
    const [headerB64] = token.split(".");
    const header = JSON.parse(atob(headerB64));

    if (header.enc) {
      // JWE token — decrypt using HKDF-derived key (Auth.js v5: A256CBC-HS512)
      const encKey = await getDerivedEncryptionKey();
      if (!encKey) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      await jwtDecrypt(token, encKey, {
        contentEncryptionAlgorithms: ["A256CBC-HS512"],
      });
    } else {
      // JWS token — verify signature with raw secret
      await jwtVerify(token, rawKey, { algorithms: ["HS256"] });
    }

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
