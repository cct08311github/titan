/**
 * Edge auth middleware module — Issue #404 (extracted from middleware.ts)
 *
 * Performs Edge JWT verification and handles unauthenticated redirects.
 * Originally introduced in Issue #129.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkEdgeJwt } from "@/lib/auth-depth";

/**
 * Public routes that bypass JWT auth check — Issue #799 (AU-6)
 * These endpoints are accessible without authentication.
 */
const AUTH_BYPASS_PREFIXES = ["/api/auth/"];
const AUTH_BYPASS_EXACT = [
  "/change-password",
  "/api/health",
];

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
  // req.nextUrl.pathname strips basePath automatically (unlike new URL(req.url).pathname)
  const pathname = req.nextUrl.pathname;

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
      // Use req.nextUrl.clone() so NextURL preserves basePath in the redirect
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("callbackUrl", pathname);
      const redirectRes = NextResponse.redirect(loginUrl);
      redirectRes.headers.set("x-request-id", requestId);
      return redirectRes;
    }
    return null; // has session cookie — let the page's auth() verify it
  }

  // API routes: Edge JWT decryption (Layer 1).
  // HKDF parameters fixed in Issue #757 to match Auth.js v5's key derivation.
  // Layer 2 auth (withAuth/withManager using auth()) still fully protects all API routes.
  return await checkEdgeJwt(req);
}
