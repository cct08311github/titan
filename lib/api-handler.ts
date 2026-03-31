import { NextRequest, NextResponse } from "next/server";
import {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "@/services/errors";
import { success, error } from "@/lib/api-response";
import type { ApiResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { requestLogger } from "@/lib/request-logger";
import { validateCsrf, CsrfError } from "@/lib/csrf";
import {
  RateLimitError,
  createApiRateLimiter,
  checkRateLimit,
} from "@/lib/rate-limiter";
import { AuditService } from "@/services/audit-service";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// ── Module-level API rate limiter (singleton, Redis-backed in production) ──
// In test/E2E environments, use a much higher limit to avoid flaky tests
const isTestEnv = process.env.NODE_ENV === "test" || process.env.E2E_TESTING === "true";
const apiLimiter = createApiRateLimiter({
  points: isTestEnv ? 10000 : undefined,
});

// ── Audit service singleton ───────────────────────────────────────────────
const auditService = new AuditService(prisma);

/** HTTP methods that represent mutating operations */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Extract a resource type from the URL path.
 * e.g. /api/tasks/123 → "tasks", /api/kpi → "kpi"
 */
function extractResourceType(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  // Expected pattern: ["api", "resource", ...rest]
  if (segments.length >= 2 && segments[0] === "api") {
    return segments[1];
  }
  return "unknown";
}

export type RouteContext = { params: Promise<Record<string, string>> };

/**
 * Wraps a Next.js route handler with unified error handling.
 *
 * Maps custom error types to HTTP status codes and returns a consistent
 * JSON shape: { ok, data?, error?, message? }
 *
 * After a successful POST/PUT/PATCH/DELETE, automatically logs an audit
 * entry via AuditService (fire-and-forget — never blocks the response).
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

        // Rate limit by IP (or forwarded IP) — applies to ALL API routes
        const rateLimitKey =
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("x-real-ip") ||
          "unknown";
        await checkRateLimit(apiLimiter, rateLimitKey);

        const response = await fn(req, context);

        // ── Auto-inject audit logging for mutating operations ──────────
        if (MUTATING_METHODS.has(req.method) && response.status >= 200 && response.status < 300) {
          // Fire-and-forget with Redis fallback: audit logging must never block the response
          const url = new URL(req.url);
          const resourceType = extractResourceType(url.pathname);
          const ipAddress =
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            req.headers.get("x-real-ip") ||
            null;

          // Resolve userId via auth() then use logAsync for Prisma-first + Redis fallback
          auth()
            .then((session: { user?: { id?: string } } | null) => {
              const userId = session?.user?.id ?? null;
              return auditService.logAsync({
                userId,
                action: `${req.method}_${resourceType.toUpperCase()}`,
                resourceType,
                detail: `${req.method} ${url.pathname}`,
                ipAddress,
              });
            })
            .catch((auditErr: unknown) => {
              // logAsync handles its own errors internally; catch here only for unexpected failures
              logger.error({ err: auditErr }, "[apiHandler] Unexpected audit error");
            });
        }

        return response;
      } catch (err) {
        // ── Banking compliance: audit failed mutations (401/403/500) ──────
        if (MUTATING_METHODS.has(req.method)) {
          const url = new URL(req.url);
          const resourceType = extractResourceType(url.pathname);
          const ipAddress =
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            req.headers.get("x-real-ip") ||
            null;
          const errorName =
            err instanceof ForbiddenError ? "FORBIDDEN" :
            err instanceof UnauthorizedError ? "UNAUTHORIZED" :
            err instanceof ValidationError ? "VALIDATION" :
            err instanceof ConflictError ? "CONFLICT" :
            "ERROR";

          // Fire-and-forget: never block the error response
          auth()
            .then((session: { user?: { id?: string } } | null) => {
              return auditService.log({
                userId: session?.user?.id ?? null,
                action: `FAILED_${req.method}_${resourceType.toUpperCase()}`,
                resourceType,
                detail: `${errorName}: ${req.method} ${url.pathname}`,
                ipAddress,
              });
            })
            .catch(() => {
              // Silently ignore audit failures for failed requests
            });
        }

        if (err instanceof CsrfError) {
          return error("ForbiddenError", err.message, 403);
        }
        if (err instanceof RateLimitError) {
          const res = error("RateLimitError", err.message, 429);
          res.headers.set("Retry-After", String(err.retryAfter));
          return res;
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
        if (err instanceof ConflictError) {
          return error("ConflictError", err.message, 409);
        }
        // Unexpected error — log details server-side, never expose internals
        logger.error({ err }, "[apiHandler] Unexpected error");
        return error("InternalServerError", "伺服器錯誤", 500);
      }
    }) as Promise<NextResponse<ApiResponse>>;
  };
  return wrapped as unknown as T;
}
