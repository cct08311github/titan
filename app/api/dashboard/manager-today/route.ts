/**
 * GET /api/dashboard/manager-today
 *
 * 今日必辦 aggregation for Manager/Admin — Issue #1323
 *
 * Returns actionable counts that a manager needs to handle today:
 *   - pendingApprovals.timesheet  : TimeEntry rows pending manager review
 *   - pendingApprovals.documents  : ApprovalRequest rows pending review
 *   - teamOverdue                 : team tasks overdue (not DONE/CANCELLED)
 *   - dueToday                    : team tasks due today (not DONE/CANCELLED)
 *   - kpiBehind                   : ACTIVE MONTHLY KPIs with low achievement
 */
import { withManager } from "@/lib/auth-middleware";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";

export const GET = withManager(async () => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // Current month period string e.g. "2026-04"
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  // Day-of-month progress (1–100)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgress = (now.getDate() / daysInMonth) * 100;

  // Fetch all counts in parallel for performance
  const [
    timesheetPending,
    approvalPending,
    overdueCount,
    dueTodayCount,
    behindKpis,
  ] = await Promise.all([
    // Pending timesheet entries from active engineers (excluding deleted)
    prisma.timeEntry.count({
      where: {
        isDeleted: false,
        approvalStatus: "PENDING",
        user: { isActive: true, role: "ENGINEER" },
      },
    }),

    // Pending general approval requests assigned to any manager
    prisma.approvalRequest.count({
      where: { status: "PENDING" },
    }),

    // Team tasks that are overdue (not DONE or CANCELLED, not sample)
    prisma.task.count({
      where: {
        isSample: false,
        dueDate: { lt: todayStart },
        status: { not: "DONE" },
        primaryAssignee: { isActive: true, role: "ENGINEER" },
      },
    }),

    // Team tasks due today (not DONE, not sample)
    prisma.task.count({
      where: {
        isSample: false,
        dueDate: { gte: todayStart, lt: todayEnd },
        status: { not: "DONE" },
        primaryAssignee: { isActive: true, role: "ENGINEER" },
      },
    }),

    // ACTIVE MONTHLY KPIs for current year with no achievement OR achievement < 80%
    // Only flag when month is already >50% through
    monthProgress > 50
      ? prisma.kPI.findMany({
          where: {
            year: now.getFullYear(),
            status: "ACTIVE",
            frequency: "MONTHLY",
          },
          select: {
            target: true,
            achievements: {
              where: { period: monthStr },
              select: { actualValue: true },
              take: 1,
            },
          },
        })
      : Promise.resolve([]),
  ]);

  // Count KPIs that are behind (no achievement or achievement/target < 80%)
  const kpiBehind = Array.isArray(behindKpis)
    ? behindKpis.filter((kpi) => {
        const ach = kpi.achievements[0];
        if (!ach) return true; // No entry yet = behind
        const pct = kpi.target > 0 ? (ach.actualValue / kpi.target) * 100 : 0;
        return pct < 80;
      }).length
    : 0;

  return success({
    pendingApprovals: {
      timesheet: timesheetPending,
      documents: approvalPending,
    },
    teamOverdue: overdueCount,
    dueToday: dueTodayCount,
    kpiBehind,
  });
});
