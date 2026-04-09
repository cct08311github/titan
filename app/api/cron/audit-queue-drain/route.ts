/**
 * POST /api/cron/audit-queue-drain — Drain Redis audit failure queue (Issue #1352)
 *
 * Retries up to 100 failed audit log entries from the Redis fallback queue
 * into PostgreSQL. Called every 5 minutes by titan-cron to prevent OOM growth.
 *
 * Protected by CRON_SECRET header (timingSafeEqual via verifyCronSecret).
 */

import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { AuditService } from "@/services/audit-service";
import { logger } from "@/lib/logger";

export const POST = apiHandler(async (req: NextRequest) => {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const service = new AuditService(prisma);
  const processed = await service.processAuditQueue();

  logger.info(
    { event: "cron_audit_drain_complete", processed },
    "Audit queue drain complete"
  );

  return success({ processed, timestamp: new Date().toISOString() });
});
