/**
 * Higher-order auth middleware wrappers for API route handlers — Issue #81
 *
 * Usage:
 *   export const GET = withAuth(async (req) => {
 *     return success(data);
 *   });
 *
 *   export const POST = withManager(async (req, context) => {
 *     const { id } = await context.params;
 *     return success(data);
 *   });
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/rbac";
import { apiHandler, RouteContext } from "@/lib/api-handler";
import type { ApiResponse } from "@/lib/api-response";

/** Route handler that accepts a request and optional route context. */
type RouteHandler = (
  req: NextRequest,
  context?: RouteContext
) => Promise<NextResponse<ApiResponse>>;

/**
 * Wraps a route handler with requireAuth check + unified error handling.
 * Any authenticated user (MANAGER or ENGINEER) may access.
 */
export function withAuth<T extends RouteHandler>(fn: T): T {
  return apiHandler(async (req: NextRequest, context?: RouteContext) => {
    await requireAuth();
    return fn(req, context);
  }) as unknown as T;
}

/**
 * Wraps a route handler with requireRole('MANAGER') check + error handling.
 * Only MANAGER role may access.
 */
export function withManager<T extends RouteHandler>(fn: T): T {
  return apiHandler(async (req: NextRequest, context?: RouteContext) => {
    await requireRole("MANAGER");
    return fn(req, context);
  }) as unknown as T;
}
