/**
 * Next.js Edge Middleware — Auth + CSP Nonce + Correlation ID (Issue #129, #190, #199)
 *
 * Refactored in Issue #404: responsibilities split into composable modules:
 *   - lib/middleware/auth.ts       — Edge JWT verification + redirect
 *   - lib/middleware/csp.ts        — CSP nonce generation + header injection
 *   - lib/middleware/correlation.ts — x-request-id propagation
 *
 * This file composes the modules in order:
 *   1. Generate correlation ID + CSP nonce
 *   2. Check auth (may short-circuit with redirect/401)
 *   3. Apply CSP + correlation headers to the passing response
 */

import { NextRequest, NextResponse } from "next/server";
import { generateNonce, applyCsp } from "@/lib/middleware/csp";
import { resolveCorrelationId, applyCorrelationId } from "@/lib/middleware/correlation";
import { checkAuth } from "@/lib/middleware/auth";

export async function middleware(req: NextRequest): Promise<NextResponse> {
  // 1. Generate per-request identifiers
  const requestId = resolveCorrelationId(req);
  const nonce = generateNonce();

  // 2. Auth check — may return redirect or 401
  const authResult = await checkAuth(req, requestId);
  if (authResult !== null) {
    return authResult;
  }

  // 3. Request passes — inject CSP + correlation into downstream headers
  const requestHeaders = new Headers(req.headers);
  const res = NextResponse.next({ request: { headers: requestHeaders } });

  applyCsp(requestHeaders, res, nonce);
  applyCorrelationId(requestHeaders, res, requestId);

  return res;
}

export const config = {
  matcher: [
    // Page routes that require a session
    "/dashboard/:path*",
    "/kanban/:path*",
    "/gantt/:path*",
    "/knowledge/:path*",
    "/kpi/:path*",
    "/plans/:path*",
    "/timesheet/:path*",
    "/reports/:path*",
    // All API routes — auth routes are excluded inside the middleware function
    "/api/:path*",
  ],
};
