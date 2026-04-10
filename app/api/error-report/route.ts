import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { createApiRateLimiter, checkRateLimit } from "@/lib/rate-limiter";
import { getRedisClient } from "@/lib/redis";
import { getClientIp } from "@/lib/get-client-ip";
import { success, error } from "@/lib/api-response";

// Issue #1217: rate limit unauthenticated error reports (10 per minute per IP)
const redis = getRedisClient();
const errorReportLimiter = createApiRateLimiter({
  redisClient: redis ?? undefined,
  useMemory: !redis,
  points: 10,
  duration: 60,
});

/**
 * POST /api/error-report — Client-side error reporting (Issue #196).
 * Persists frontend errors to AuditLog for tracking and investigation.
 * No auth required — errors may occur before/during auth flows.
 */
export async function POST(req: NextRequest) {
  // Rate limit check
  const ip = getClientIp(req) ?? "unknown";
  try {
    await checkRateLimit(errorReportLimiter, `error_report_${ip}`);
  } catch {
    return error("RateLimitError", "Too many requests", 429);
  }

  try {
    const body = await req.json();
    const { message, digest, source, url } = body as {
      message?: string;
      digest?: string;
      source?: string;
      url?: string;
    };

    if (!message) {
      return error("ValidationError", "message required", 400);
    }

    // Cap each field to prevent log-flood DoS via giant payloads.
    const detail = JSON.stringify({
      message: String(message).slice(0, 2000),
      digest: digest ? String(digest).slice(0, 200) : null,
      source: source ? String(source).slice(0, 100) : "unknown",
      url: url ? String(url).slice(0, 500) : null,
      userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    });

    await prisma.auditLog.create({
      data: {
        userId: null,
        action: "FRONTEND_ERROR",
        resourceType: "error",
        resourceId: digest ?? null,
        detail,
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      },
    });

    logger.warn({ source, url, digest }, `Frontend error: ${String(message).slice(0, 200)}`);

    return success({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to persist error report");
    return error("InternalError", "internal", 500);
  }
}
