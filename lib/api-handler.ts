import { NextRequest, NextResponse } from "next/server";
import {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "@/services/errors";
import { success, error } from "@/lib/api-response";
import type { ApiResponse } from "@/lib/api-response";

type RouteHandler<TParams = undefined> = TParams extends undefined
  ? (req: NextRequest) => Promise<NextResponse<ApiResponse>>
  : (req: NextRequest, context: { params: Promise<TParams> }) => Promise<NextResponse<ApiResponse>>;

/**
 * Wraps a Next.js route handler with unified error handling.
 *
 * Maps custom error types to HTTP status codes and returns a consistent
 * JSON shape: { ok, data?, error?, message? }
 *
 * Usage (simple):
 *   export const GET = apiHandler(async (req) => {
 *     return success(data);
 *   });
 *
 * Usage (with dynamic params):
 *   export const GET = apiHandler(async (req, { params }) => {
 *     const { id } = await params;
 *     return success(data);
 *   });
 */
export function apiHandler(
  fn: (req: NextRequest, context?: { params: Promise<Record<string, string>> }) => Promise<NextResponse<ApiResponse>>
): (req: NextRequest, context?: { params: Promise<Record<string, string>> }) => Promise<NextResponse<ApiResponse>> {
  return async (
    req: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse<ApiResponse>> => {
    try {
      return await fn(req, context);
    } catch (err) {
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
      console.error("[apiHandler] Unexpected error:", err);
      return error("InternalServerError", "伺服器錯誤", 500);
    }
  };
}
