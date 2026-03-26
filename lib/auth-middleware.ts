/**
 * Higher-order auth middleware wrappers — Issue #81, #801
 * Three-role hierarchy: ADMIN > MANAGER > ENGINEER
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireMinRole } from "@/lib/rbac";
import { apiHandler, RouteContext } from "@/lib/api-handler";
import type { ApiResponse } from "@/lib/api-response";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (req: NextRequest, context?: any) => Promise<NextResponse<ApiResponse>>;

export function withAuth<T extends RouteHandler>(fn: T): T {
  return apiHandler(async (req: NextRequest, context?: RouteContext) => {
    await requireAuth();
    return fn(req, context);
  }) as unknown as T;
}

export function withManager<T extends RouteHandler>(fn: T): T {
  return apiHandler(async (req: NextRequest, context?: RouteContext) => {
    await requireMinRole("MANAGER");
    return fn(req, context);
  }) as unknown as T;
}

export function withAdmin<T extends RouteHandler>(fn: T): T {
  return apiHandler(async (req: NextRequest, context?: RouteContext) => {
    await requireMinRole("ADMIN");
    return fn(req, context);
  }) as unknown as T;
}
