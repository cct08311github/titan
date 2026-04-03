import { NextResponse } from "next/server";
import { serializeMetrics } from "@/lib/metrics";
import { withAuth } from "@/lib/auth-middleware";

/**
 * GET /api/metrics — Prometheus-compatible metrics endpoint (Issue #195).
 * Returns application metrics in text exposition format.
 * Protected by auth — Issue #1206.
 */
export const GET = withAuth(async () => {
  return new NextResponse(serializeMetrics(), {
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
  });
});
