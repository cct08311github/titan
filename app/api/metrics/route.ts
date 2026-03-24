import { NextResponse } from "next/server";
import { serializeMetrics } from "@/lib/metrics";

/**
 * GET /api/metrics — Prometheus-compatible metrics endpoint (Issue #195).
 * Returns application metrics in text exposition format.
 */
export async function GET() {
  return new NextResponse(serializeMetrics(), {
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
  });
}
