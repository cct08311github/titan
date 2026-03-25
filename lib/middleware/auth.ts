/**
 * Edge auth middleware module — Issue #404 (extracted from middleware.ts)
 *
 * Performs Edge JWT verification and handles unauthenticated redirects.
 * Originally introduced in Issue #129.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkEdgeJwt } from "@/lib/auth-depth";

/** Routes that bypass auth check */
const AUTH_BYPASS_PREFIXES = ["/api/auth/"];
const AUTH_BYPASS_EXACT = ["/change-password"];

/** Check if a pathname should bypass auth */
export function shouldBypassAuth(pathname: string): boolean {
  if (AUTH_BYPASS_EXACT.includes(pathname)) return true;
  return AUTH_BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Perform Edge JWT check.
 *
 * @returns null if the request should proceed (authenticated or bypassed)
 * @returns NextResponse redirect/401 if blocked
 */
export async function checkAuth(
  req: NextRequest,
  requestId: string
): Promise<NextResponse | null> {
  const { pathname } = new URL(req.url);

  if (shouldBypassAuth(pathname)) {
    return null; // allow — CSP/correlation still applied by caller
  }

  // Page routes: skip full Edge JWT decryption, use cookie-presence check instead.
  // Server-side auth() in the page handles full session validation.
  if (!pathname.startsWith("/api/")) {
    // Check if session cookie exists at all (quick presence check, not cryptographic)
    const cookieHeader = req.headers.get("cookie") ?? "";
    const hasSession = cookieHeader.includes("authjs.session-token");
    if (!hasSession) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      const redirectRes = NextResponse.redirect(loginUrl);
      redirectRes.headers.set("x-request-id", requestId);
      return redirectRes;
    }
    return null; // has session cookie — let the page's auth() verify it
  }

  // API routes: Edge JWT verification (Layer 1 — defense-in-depth).
  // Auth.js v5 A256CBC-HS512 JWE is now supported in checkEdgeJwt().
  // Layer 2 auth (withAuth/withManager using auth()) still protects all API routes.
  return checkEdgeJwt(req);
}
