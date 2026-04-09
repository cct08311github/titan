/**
 * POST /api/cron/daily-digest — Daily digest push at 17:00 (Issue #1004)
 *
 * Generates a digest of unconfirmed time suggestions for each user.
 * Creates a Notification for users with unconfirmed entries.
 *
 * Protected by CRON_SECRET header validation (required if env var is set).
 * Edge JWT middleware also blocks unauthenticated external requests.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { verifyCronSecret } from "@/lib/cron-auth";

export const POST = apiHandler(async (req: NextRequest) => {
  const authError = verifyCronSecret(req);
  if (authError) return authError;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Find all users with unconfirmed time entries (PENDING approval) for today
  const pendingEntries = await prisma.timeEntry.findMany({
    where: {
      date: { gte: today },
      approvalStatus: "PENDING",
      isDeleted: false,
    },
    select: {
      userId: true,
      hours: true,
      task: { select: { title: true } },
    },
  });

  // Group by user
  const userMap = new Map<string, { totalHours: number; taskCount: number }>();
  for (const entry of pendingEntries) {
    const existing = userMap.get(entry.userId) ?? { totalHours: 0, taskCount: 0 };
    existing.totalHours += entry.hours;
    existing.taskCount += 1;
    userMap.set(entry.userId, existing);
  }

  // Create notifications for each user with unconfirmed entries
  const notifications = [];
  for (const [userId, stats] of userMap.entries()) {
    notifications.push({
      userId,
      type: "TIMESHEET_REMINDER" as const,
      title: "每日工時摘要",
      body: `您有 ${stats.taskCount} 筆未確認工時紀錄，共 ${stats.totalHours.toFixed(1)} 小時。請至工時頁面確認。`,
      relatedType: "DIGEST",
    });
  }

  let created = 0;
  if (notifications.length > 0) {
    const result = await prisma.notification.createMany({
      data: notifications,
    });
    created = result.count;
  }

  return success({
    created,
    usersNotified: userMap.size,
    checkedAt: now.toISOString(),
  });
});
