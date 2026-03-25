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

  const jwtResult = await checkEdgeJwt(req);
  if (jwtResult !== null) {
    // Page routes: redirect to /login instead of returning 401 JSON
    if (!pathname.startsWith("/api/")) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      const redirectRes = NextResponse.redirect(loginUrl);
      redirectRes.headers.set("x-request-id", requestId);
      return redirectRes;
    }
    jwtResult.headers.set("x-request-id", requestId);
    return jwtResult; // 401 response for API routes
  }

  return null; // authenticated — proceed
}
