/**
 * POST /api/integrations/monitoring/webhook — Receive monitoring alerts
 *
 * Accepts Grafana/Prometheus webhook payloads.
 * Auth: API key via Authorization: Bearer {key} (env: MONITORING_WEBHOOK_KEY)
 *
 * Issue #863: External Monitoring Integration
 */

import { timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { MonitoringService } from "@/services/monitoring-service";
import { validateBody } from "@/lib/validate";
import { webhookPayloadSchema } from "@/validators/monitoring-validators";
import { success, error } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { createApiRateLimiter, checkRateLimit } from "@/lib/rate-limiter";
import { getRedisClient } from "@/lib/redis";
import { getClientIp } from "@/lib/get-client-ip";

// 60 requests per minute per IP (higher than user endpoints since monitoring sends bursts)
const redis = getRedisClient();
const webhookLimiter = createApiRateLimiter({
  redisClient: redis ?? undefined,
  useMemory: !redis,
  points: 60,
  duration: 60,
});

export const POST = apiHandler(async (req: NextRequest) => {
  // API key auth (no user session required)
  const expectedKey = process.env.MONITORING_WEBHOOK_KEY;
  if (!expectedKey) {
    return error("SERVICE_UNAVAILABLE", "Webhook endpoint not configured", 503);
  }
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  const expectedBuf = Buffer.from(expectedKey, "utf8");
  const providedBuf = Buffer.from(token ?? "", "utf8");
  if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
    return error("UNAUTHORIZED", "Invalid API key", 401);
  }

  const ip = getClientIp(req) ?? "unknown";
  try {
    await checkRateLimit(webhookLimiter, `webhook_${ip}`);
  } catch {
    return error("RateLimitError", "Too many requests", 429);
  }

  const raw = await req.json();
  const body = validateBody(webhookPayloadSchema, raw);

  const service = new MonitoringService(prisma);
  const alert = await service.processWebhook(body);

  return success(alert, 201);
});
