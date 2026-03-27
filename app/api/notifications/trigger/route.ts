/**
 * POST /api/notifications/trigger — Trigger scheduled email notifications
 *
 * Scans for due/overdue tasks and sends email notifications.
 * Designed to be called by cron job (every hour) or manually by MANAGER.
 * Idempotent: same-hour repeated calls do not duplicate emails.
 *
 * MANAGER+ only — prevents Engineers from triggering system-wide notifications.
 *
 * Issue #864: Email Notification Channel
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { EmailNotificationService } from "@/services/email-notification-service";
import { success } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";

export const POST = withManager(async (_req: NextRequest) => {
  const service = new EmailNotificationService(prisma);
  const now = new Date();
  const result = await service.trigger(now);

  return success({
    ...result,
    checkedAt: now.toISOString(),
  });
});
