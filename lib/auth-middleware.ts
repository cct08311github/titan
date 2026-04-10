/**
 * Higher-order auth middleware wrappers — Issue #81, #801
 * Three-role hierarchy: ADMIN > MANAGER > ENGINEER
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireMinRole, enforcePasswordChange } from "@/lib/rbac";
import { apiHandler, RouteContext } from "@/lib/api-handler";
import type { ApiResponse } from "@/lib/api-response";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (req: NextRequest, context?: any) => Promise<NextResponse<ApiResponse>>;

export function withAuth<T extends RouteHandler>(fn: T): T {
  return apiHandler(async (req: NextRequest, context?: RouteContext) => {
    const session = await requireAuth();
    // Server-side enforcement of password change policy.
    // If mustChangePassword is true (first login or expired), block
    // non-exempt routes to prevent access with stale credentials.
    enforcePasswordChange(session, new URL(req.url).pathname);
    return fn(req, context);
  }) as unknown as T;
}

export function withManager<T extends RouteHandler>(fn: T): T {
  return apiHandler(async (req: NextRequest, context?: RouteContext) => {
    const session = await requireMinRole("MANAGER");
    enforcePasswordChange(session, new URL(req.url).pathname);
    return fn(req, context);
  }) as unknown as T;
}

export function withAdmin<T extends RouteHandler>(fn: T): T {
  return apiHandler(async (req: NextRequest, context?: RouteContext) => {
    const session = await requireMinRole("ADMIN");
    enforcePasswordChange(session, new URL(req.url).pathname);
    return fn(req, context);
  }) as unknown as T;
}
