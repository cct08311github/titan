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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (req: NextRequest, context?: any) => Promise<NextResponse<ApiResponse>>;

/**
 * Wraps a route handler with requireAuth check + unified error handling.
 * Any authenticated user (MANAGER or ENGINEER) may access.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withAuth<T extends AnyHandler>(fn: T): T {
  return apiHandler(async (req: NextRequest, context?: RouteContext) => {
    await requireAuth();
    return fn(req, context);
  }) as unknown as T;
}

/**
 * Wraps a route handler with requireRole('MANAGER') check + error handling.
 * Only MANAGER role may access.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withManager<T extends AnyHandler>(fn: T): T {
  return apiHandler(async (req: NextRequest, context?: RouteContext) => {
    await requireRole("MANAGER");
    return fn(req, context);
  }) as unknown as T;
}
