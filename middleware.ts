/**
 * Next.js Edge Middleware — Auth Defense in Depth + Request Correlation (Issue #129, #199)
 *
 * Layer 1 (this file, Edge runtime): lightweight JWT verification + request ID injection.
 *   - Applies to all /api/* routes except /api/auth/*
 *   - Uses NEXTAUTH_SECRET to verify the JWT signature and expiry
 *   - Blocks unauthenticated, expired, or tampered tokens with HTTP 401
 *   - Injects x-request-id header for cross-layer tracing (middleware → service → log)
 *
 * Layer 2 (route handlers, Node.js runtime): full DB session check.
 *   - withAuth / withManager wrappers are kept on ALL route handlers (not removed)
 *   - getServerSession() re-validates the session against the database on every call
 *
 * Neither layer alone is sufficient — both must pass for a request to succeed.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkEdgeJwt } from "@/lib/auth-depth";

/** Inject x-request-id into both the request (downstream) and response (client). */
function withRequestId(
  req: NextRequest,
  res: NextResponse,
  requestId: string
): NextResponse {
  res.headers.set("x-request-id", requestId);
  // Forward to downstream handlers via request headers
  req.headers.set("x-request-id", requestId);
  return res;
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = new URL(req.url);

  // Request Correlation ID (Issue #199)
  // Reuse upstream ID (from Nginx/LB) or generate a new UUID v4
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  // Skip auth routes — next-auth handles its own sign-in / callback / CSRF flows
  if (pathname.startsWith("/api/auth/")) {
    return withRequestId(req, NextResponse.next(), requestId);
  }

  // Skip the change-password page itself to avoid redirect loops
  if (pathname === "/change-password") {
    return withRequestId(req, NextResponse.next(), requestId);
  }

  // Perform Edge JWT check
  const jwtResult = await checkEdgeJwt(req);
  if (jwtResult !== null) {
    // Page routes: redirect to /login instead of returning 401 JSON
    if (!pathname.startsWith("/api/")) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return withRequestId(req, NextResponse.redirect(loginUrl), requestId);
    }
    // Include request ID in error responses for tracing
    jwtResult.headers.set("x-request-id", requestId);
    return jwtResult;
  }

  // Forward request ID to downstream route handlers
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("x-request-id", requestId);
  return res;
}

export const config = {
  matcher: [
    // Page routes that require a session
    "/dashboard/:path*",
    "/kanban/:path*",
    "/gantt/:path*",
    "/knowledge/:path*",
    "/timesheet/:path*",
    "/reports/:path*",
    // All API routes — auth routes are excluded inside the middleware function
    "/api/:path*",
  ],
};
