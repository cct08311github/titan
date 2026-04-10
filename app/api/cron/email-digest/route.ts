/**
 * POST /api/cron/email-digest — Daily personal digest email (Issue #1321)
 *
 * Sends each active user a personalized daily digest at 08:00 containing:
 *   - Today's due tasks (if any)
 *   - Yesterday's new task assignments
 *   - Unread @mention/comment count
 *   - Pending approval count (MANAGER/ADMIN only)
 *
 * Called daily at 08:00 by titan-cron (reuses the daily-digest schedule slot).
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
  const result = await service.generateDailyDigest(now);

  logger.info(
    { event: "cron_email_digest_complete", ...result },
    "Daily email digest complete"
  );

  return success({ ...result, timestamp: now.toISOString() });
});
