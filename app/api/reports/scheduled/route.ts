import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";
import { ReportService } from "@/services/report-service";

const reportService = new ReportService(prisma);

/**
 * POST /api/reports/scheduled
 *
 * Generates a weekly report and creates in-app notifications for all MANAGERs.
 * Intended to be called by a cron job every Monday at 09:00.
 *
 * Cron schedule: 0 9 * * 1  (every Monday at 09:00)
 *
 * Flow:
 *   1. Generate the weekly report for the previous week
 *   2. Find all active users with MANAGER role
 *   3. Create a notification for each manager with report summary
 *
 * Requires MANAGER role (cron should authenticate as a service account with MANAGER role).
 */
export const POST = withManager(async (_req: NextRequest) => {
  // Generate report for previous week (use last Friday as reference)
  const now = new Date();
  const lastFriday = new Date(now);
  const dayOfWeek = now.getDay();
  const daysBack = dayOfWeek === 0 ? 2 : dayOfWeek === 1 ? 3 : dayOfWeek + 2;
  lastFriday.setDate(now.getDate() - daysBack);

  const report = await reportService.getWeeklyReport({
    isManager: true,
    userId: "",
    refDate: lastFriday,
  });

  // Find all active managers
  const managers = await prisma.user.findMany({
    where: { isActive: true, role: "MANAGER" },
    select: { id: true },
  });

  // Build notification summary
  const periodStart = new Date(report.period.start).toLocaleDateString("zh-TW");
  const periodEnd = new Date(report.period.end).toLocaleDateString("zh-TW");
  const summary = [
    `期間：${periodStart} ~ ${periodEnd}`,
    `完成任務：${report.completedCount} 項`,
    `總工時：${report.totalHours.toFixed(1)} 小時`,
    `逾期任務：${report.overdueCount} 項`,
    `延期變更：${report.delayCount} 次`,
  ].join("\n");

  // Create notifications for all managers
  const weekKey = `report-${report.period.start.toISOString().slice(0, 10)}`;

  // Check for existing notifications to avoid duplicates
  const existing = await prisma.notification.findMany({
    where: {
      type: "TASK_CHANGED", // Reuse existing type for report notifications
      relatedId: weekKey,
      isRead: false,
    },
    select: { userId: true },
  });
  const existingUserIds = new Set(existing.map((n) => n.userId));

  const notifications = managers
    .filter((m) => !existingUserIds.has(m.id))
    .map((m) => ({
      userId: m.id,
      type: "TASK_CHANGED" as const,
      title: "週報已產生",
      body: summary,
      relatedId: weekKey,
      relatedType: "Report",
    }));

  let created = 0;
  if (notifications.length > 0) {
    const result = await prisma.notification.createMany({
      data: notifications,
    });
    created = result.count;
  }

  return success({
    report: {
      period: { start: periodStart, end: periodEnd },
      completedCount: report.completedCount,
      totalHours: report.totalHours,
      overdueCount: report.overdueCount,
      delayCount: report.delayCount,
      scopeChangeCount: report.scopeChangeCount,
    },
    notified: created,
    managers: managers.length,
  });
});
