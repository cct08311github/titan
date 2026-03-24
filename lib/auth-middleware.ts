/**
 * Higher-order auth middleware wrappers for API route handlers — Issue #81
 *
 * Usage:
 *   export const GET = withAuth(async (req) => {
 *     return success(data);
 *   });
 *
 *   export const POST = withManager(async (req) => {
 *     return success(data);
 *   });
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/rbac";
import { apiHandler } from "@/lib/api-handler";
import type { ApiResponse } from "@/lib/api-response";

type RouteHandler = (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse<ApiResponse>>;

/**
 * Wraps a route handler with requireAuth check + unified error handling.
 * Any authenticated user (MANAGER or ENGINEER) may access.
 */
export function withAuth(fn: RouteHandler): RouteHandler {
  return apiHandler(async (req, context) => {
    await requireAuth();
    return fn(req, context);
  });
}

/**
 * Wraps a route handler with requireRole('MANAGER') check + error handling.
 * Only MANAGER role may access.
 */
export function withManager(fn: RouteHandler): RouteHandler {
  return apiHandler(async (req, context) => {
    await requireRole("MANAGER");
    return fn(req, context);
  });
}
