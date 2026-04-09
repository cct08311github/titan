/**
 * POST /api/cron/email-notifications — Trigger scheduled email notifications (Issue #1352)
 *
 * Scans for due/overdue tasks and timesheet reminders, then sends emails
 * to relevant users. Idempotent within the same hour (uses NotificationLog).
 * Called every 15 minutes by titan-cron.
 *
 * Protected by CRON_SECRET header (timingSafeEqual via verifyCronSecret).
 */

import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { EmailNotificationService } from "@/services/email-notification-service";
import { logger } from "@/lib/logger";

export const POST = apiHandler(async (req: NextRequest) => {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const service = new EmailNotificationService(prisma);
  const now = new Date();
  const result = await service.trigger(now);

  logger.info(
    { event: "cron_email_trigger_complete", ...result },
    "Email notification trigger complete"
  );

  return success({ ...result, timestamp: now.toISOString() });
});
