/**
 * Shared cron authentication helper (Issue #1352)
 *
 * Replaces inline `!==` secret comparison in all cron routes with
 * crypto.timingSafeEqual to prevent timing-based secret leakage.
 */

import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { error, type ApiResponse } from "@/lib/api-response";
import { NextResponse } from "next/server";

/**
 * Verify the x-cron-secret header against CRON_SECRET env var.
 *
 * Returns null if auth passes (caller may proceed).
 * Returns a NextResponse error if auth fails (caller must return it immediately).
 */
export function verifyCronSecret(
  req: NextRequest
): NextResponse<ApiResponse> | null {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return error("ServerError", "CRON_SECRET not configured", 503);
  }

  const provided = req.headers.get("x-cron-secret");
  if (!provided) {
    return error("UnauthorizedError", "Missing cron secret header", 401);
  }

  // timingSafeEqual requires equal-length buffers; length mismatch is itself rejected
  const expectedBuf = Buffer.from(expectedSecret, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");

  if (expectedBuf.length !== providedBuf.length) {
    return error("UnauthorizedError", "Invalid cron secret", 401);
  }

  if (!timingSafeEqual(expectedBuf, providedBuf)) {
    return error("UnauthorizedError", "Invalid cron secret", 401);
  }

  return null; // auth passed
}
