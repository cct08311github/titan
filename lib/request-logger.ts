/**
 * Request/response logging middleware for Next.js API routes.
 * Issue #82: Structured logging with pino
 *
 * Logs: method, path, status, durationMs, userId
 * Masks: authorization, cookie headers
 */
import type { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/** Headers whose values must never be logged in plain text. */
const SENSITIVE_HEADERS = new Set(["authorization", "cookie"]);

const SLOW_REQUEST_THRESHOLD_MS = Number(process.env.SLOW_REQUEST_THRESHOLD_MS ?? 3000);

/**
 * Wraps a Next.js route handler, logging the request and response.
 *
 * Usage:
 *   return requestLogger(req, async () => {
 *     return someHandler(req);
 *   });
 */
export async function requestLogger(
  req: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const start = Date.now();
  const { method } = req;
  const url = new URL(req.url);
  const path = url.pathname;

  // Extract userId from x-user-id header (set by auth middleware) or session
  const userId = req.headers.get("x-user-id") ?? undefined;
  const requestId = req.headers.get("x-request-id") ?? undefined;

  // Build a safe headers snapshot (mask sensitive values)
  // req.headers may be a real Headers object (forEach) or a minimal mock (get only)
  const safeHeaders: Record<string, string> = {};
  if (typeof req.headers.forEach === "function") {
    req.headers.forEach((value: string, key: string) => {
      safeHeaders[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? "[REDACTED]" : value;
    });
  }

  const res = await handler();

  const durationMs = Date.now() - start;
  const status = res.status;

  logger.info(
    {
      method,
      path,
      status,
      durationMs,
      ...(userId !== undefined ? { userId } : {}),
      ...(requestId !== undefined ? { requestId } : {}),
    },
    "api request"
  );

  if (durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
    logger.warn(
      {
        event: "slow_request",
        method,
        path,
        durationMs,
        ...(userId !== undefined ? { userId } : {}),
        ...(requestId !== undefined ? { requestId } : {}),
      },
      `Slow request: ${method} ${path} took ${durationMs}ms`
    );
  }

  return res;
}
