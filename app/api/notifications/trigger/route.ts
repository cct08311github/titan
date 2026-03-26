/**
 * POST /api/notifications/trigger — Trigger scheduled email notifications
 *
 * Scans for due/overdue tasks and sends email notifications.
 * Designed to be called by cron job (every hour) or manually.
 * Idempotent: same-hour repeated calls do not duplicate emails.
 *
 * Issue #864: Email Notification Channel
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { EmailNotificationService } from "@/services/email-notification-service";
import { success } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

export const POST = apiHandler(async (_req: NextRequest) => {
  const service = new EmailNotificationService(prisma);
  const now = new Date();
  const result = await service.trigger(now);

  return success({
    ...result,
    checkedAt: now.toISOString(),
  });
});
