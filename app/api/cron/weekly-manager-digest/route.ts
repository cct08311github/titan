/**
 * POST /api/cron/weekly-manager-digest — Weekly manager summary email (Issue #1321)
 *
 * Sends a weekly summary to MANAGER and ADMIN users containing:
 *   - Team health snapshot (overdue count, flagged count)
 *   - This week's velocity (completed tasks count)
 *   - KPI items behind schedule
 *   - Next week's due items
 *
 * Called every Friday at 16:00 by titan-cron.
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
  const result = await service.generateWeeklyManagerSummary(now);

  logger.info(
    { event: "cron_weekly_manager_digest_complete", ...result },
    "Weekly manager digest complete"
  );

  return success({ ...result, timestamp: now.toISOString() });
});
