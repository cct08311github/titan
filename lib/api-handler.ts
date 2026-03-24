import { NextRequest, NextResponse } from "next/server";
import {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "@/services/errors";
import { success, error } from "@/lib/api-response";
import type { ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { requestLogger } from "@/lib/request-logger";
import { validateCsrf, CsrfError } from "@/lib/csrf";

export type RouteContext = { params: Promise<Record<string, string>> };

/**
 * Wraps a Next.js route handler with unified error handling.
 *
 * Maps custom error types to HTTP status codes and returns a consistent
 * JSON shape: { ok, data?, error?, message? }
 *
 * Usage (simple, non-dynamic route):
 *   export const GET = apiHandler(async (req) => {
 *     return success(data);
 *   });
 *
 * Usage (with dynamic params, Next.js 15 — context is required, not optional):
 *   export const GET = apiHandler(async (req, context) => {
 *     const { id } = await context.params;
 *     return success(data);
 *   });
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apiHandler<T extends (...args: any[]) => Promise<NextResponse<ApiResponse>>>(
  fn: T
): T {
  const wrapped = async (
    req: NextRequest,
    context?: RouteContext
  ): Promise<NextResponse<ApiResponse>> => {
    return requestLogger(req, async () => {
      try {
        validateCsrf(req);
        return await fn(req, context);
      } catch (err) {
        if (err instanceof CsrfError) {
          return error("ForbiddenError", err.message, 403);
        }
        if (err instanceof ValidationError) {
          return error("ValidationError", err.message, 400);
        }
        if (err instanceof UnauthorizedError) {
          return error("UnauthorizedError", err.message, 401);
        }
        if (err instanceof ForbiddenError) {
          return error("ForbiddenError", err.message, 403);
        }
        if (err instanceof NotFoundError) {
          return error("NotFoundError", err.message, 404);
        }
        // Unexpected error — log details server-side, never expose internals
        logger.error({ err }, "[apiHandler] Unexpected error");
        return error("InternalServerError", "伺服器錯誤", 500);
      }
    }) as Promise<NextResponse<ApiResponse>>;
  };
  return wrapped as unknown as T;
}
