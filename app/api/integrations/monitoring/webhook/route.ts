/**
 * POST /api/integrations/monitoring/webhook — Receive monitoring alerts
 *
 * Accepts Grafana/Prometheus webhook payloads.
 * Auth: API key via Authorization: Bearer {key} (env: MONITORING_WEBHOOK_KEY)
 *
 * Issue #863: External Monitoring Integration
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { MonitoringService } from "@/services/monitoring-service";
import { validateBody } from "@/lib/validate";
import { webhookPayloadSchema } from "@/validators/monitoring-validators";
import { success, error } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

export const POST = apiHandler(async (req: NextRequest) => {
  // API key auth (no user session required)
  const expectedKey = process.env.MONITORING_WEBHOOK_KEY;
  if (!expectedKey) {
    return error("SERVICE_UNAVAILABLE", "Webhook endpoint not configured", 503);
  }
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (token !== expectedKey) {
    return error("UNAUTHORIZED", "Invalid API key", 401);
  }

  const raw = await req.json();
  const body = validateBody(webhookPayloadSchema, raw);

  const service = new MonitoringService(prisma);
  const alert = await service.processWebhook(body);

  return success(alert, 201);
});
