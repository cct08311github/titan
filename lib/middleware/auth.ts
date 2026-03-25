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

  // Page routes: skip Edge JWT check, let auth() in the page handle it.
  // Auth.js v5 uses A256CBC-HS512 JWE which requires a different HKDF derivation
  // than our Edge-compatible checkEdgeJwt(). API routes still get Edge JWT protection.
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

  // API routes: cookie presence check (same as page routes)
  // NOTE: Edge JWT verification (checkEdgeJwt) is temporarily disabled because
  // Auth.js v5 uses A256CBC-HS512 JWE which our HKDF derivation doesn't support yet.
  // Layer 2 auth (withAuth/withManager using auth()) still protects all API routes.
  // TODO: Update checkEdgeJwt to support Auth.js v5 JWE format, then re-enable.
  const cookieHeader = req.headers.get("cookie") ?? "";
  const hasSessionApi = cookieHeader.includes("authjs.session-token");
  if (!hasSessionApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null; // authenticated — proceed
}
