/**
 * GET /api/health — Issue #390
 *
 * Public health check endpoint (no auth required).
 * Checks database and Redis connectivity.
 * Returns 200 when all checks pass, 503 when any check fails.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRedisClient } from "@/lib/redis";

interface HealthCheck {
  status: "ok" | "error";
  latency?: number;
  error?: string;
}

export async function GET() {
  const checks: Record<string, HealthCheck> = {};
  let allOk = true;

  // Database check — SELECT 1
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latency: Date.now() - dbStart };
  } catch (err) {
    allOk = false;
    checks.database = {
      status: "error",
      latency: Date.now() - dbStart,
      error: err instanceof Error ? err.message : "Unknown database error",
    };
  }

  // Redis check — PING
  const redisStart = Date.now();
  try {
    const redis = getRedisClient();
    if (redis) {
      const pong = await redis.ping();
      checks.redis = {
        status: pong === "PONG" ? "ok" : "error",
        latency: Date.now() - redisStart,
      };
      if (pong !== "PONG") allOk = false;
    } else {
      // Redis not configured — report as unavailable but not a hard failure
      checks.redis = { status: "ok", latency: 0, error: "not configured" };
    }
  } catch (err) {
    allOk = false;
    checks.redis = {
      status: "error",
      latency: Date.now() - redisStart,
      error: err instanceof Error ? err.message : "Unknown redis error",
    };
  }

  const body = {
    status: allOk ? "ok" : "degraded",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks,
  };

  return NextResponse.json(body, { status: allOk ? 200 : 503 });
}
