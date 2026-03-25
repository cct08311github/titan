/**
 * Request correlation ID middleware module — Issue #404 (extracted from middleware.ts)
 *
 * Ensures every request has a unique x-request-id for cross-layer tracing.
 * Originally introduced in Issue #199.
 */

import { NextRequest, NextResponse } from "next/server";

const CORRELATION_HEADER = "x-request-id";

/** Extract upstream request ID or generate a new UUID v4 */
export function resolveCorrelationId(req: NextRequest): string {
  return req.headers.get(CORRELATION_HEADER) ?? crypto.randomUUID();
}

/** Apply correlation ID to both request headers and response headers */
export function applyCorrelationId(
  reqHeaders: Headers,
  res: NextResponse,
  requestId: string
): void {
  reqHeaders.set(CORRELATION_HEADER, requestId);
  res.headers.set(CORRELATION_HEADER, requestId);
}
