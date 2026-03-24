/**
 * Next.js Edge Middleware — Auth Defense in Depth (Issue #129)
 *
 * Layer 1 (this file, Edge runtime): lightweight JWT verification.
 *   - Applies to all /api/* routes except /api/auth/*
 *   - Uses NEXTAUTH_SECRET to verify the JWT signature and expiry
 *   - Blocks unauthenticated, expired, or tampered tokens with HTTP 401
 *   - Logs every blocked request via the structured logger
 *
 * Layer 2 (route handlers, Node.js runtime): full DB session check.
 *   - withAuth / withManager wrappers are kept on ALL route handlers (not removed)
 *   - getServerSession() re-validates the session against the database on every call
 *
 * Neither layer alone is sufficient — both must pass for a request to succeed.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkEdgeJwt } from "@/lib/auth-depth";

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = new URL(req.url);

  // Skip auth routes — next-auth handles its own sign-in / callback / CSRF flows
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // Perform Edge JWT check for all other /api/* routes
  const jwtResult = await checkEdgeJwt(req);
  if (jwtResult !== null) {
    return jwtResult; // 401 response — blocked at Edge before hitting Node.js
  }

  return NextResponse.next();
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
