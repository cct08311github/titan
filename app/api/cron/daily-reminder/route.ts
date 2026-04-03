/**
 * POST /api/cron/daily-reminder — Daily timesheet reminder trigger (TS-29)
 *
 * Triggers the daily timesheet reminder logic from NotificationService.
 * Designed to be called by a cron job (e.g., at 18:00 daily) or manually.
 *
 * Protected by CRON_SECRET header validation (required if env var is set).
 * Edge JWT middleware also blocks unauthenticated external requests.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error } from "@/lib/api-response";
import { NotificationService } from "@/services/notification-service";
import { apiHandler } from "@/lib/api-handler";

export const POST = apiHandler(async (req: NextRequest) => {
  // Issue #1210: always enforce CRON_SECRET — reject if not configured
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return error("ServerError", "CRON_SECRET not configured", 500);
  }
  const provided = req.headers.get("x-cron-secret");
  if (provided !== expectedSecret) {
    return error("UnauthorizedError", "Invalid cron secret", 401);
  }
  const service = new NotificationService(prisma);
  const now = new Date();

  // Get existing keys to avoid duplicates
  const existingKeys = await service.getExistingKeys();

  // Build daily reminders (skips weekends internally)
  const reminders = await service.buildDailyTimesheetReminders(now, existingKeys);

  let created = 0;
  if (reminders.length > 0) {
    const result = await prisma.notification.createMany({
      data: reminders,
    });
    created = result.count;
  }

  return success({
    created,
    checked: now.toISOString(),
    isWeekend: now.getDay() === 0 || now.getDay() === 6,
  });
});
