/**
 * Task Summary Metrics API — Issue #808 (D-2)
 *
 * GET /api/metrics/task-summary?period=week
 * Returns task counts by status for current and previous week.
 * Manager sees all team tasks; Engineer sees own tasks only.
 * Week boundary: Monday 00:00 ~ Sunday 23:59 in Asia/Taipei.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";

/** Get Monday 00:00:00 and Sunday 23:59:59 for a given date in Asia/Taipei */
function getWeekBounds(refDate: Date): { start: Date; end: Date } {
  // Convert to Asia/Taipei to find the correct day-of-week
  const taipeiStr = refDate.toLocaleString("en-US", { timeZone: "Asia/Taipei" });
  const taipeiDate = new Date(taipeiStr);

  const day = taipeiDate.getDay(); // 0=Sun
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(taipeiDate);
  monday.setDate(taipeiDate.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // Convert back to UTC by parsing as Asia/Taipei offset
  // Asia/Taipei is always UTC+8
  const startUtc = new Date(monday.getTime() - 8 * 60 * 60 * 1000);
  const endUtc = new Date(sunday.getTime() - 8 * 60 * 60 * 1000);

  return { start: startUtc, end: endUtc };
}

export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const isManager = session.user.role === "MANAGER" || session.user.role === "ADMIN";

  const now = new Date();
  const thisWeek = getWeekBounds(now);

  const prevWeekRef = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastWeek = getWeekBounds(prevWeekRef);

  // Build assignee filter: ENGINEER sees own only
  const assigneeFilter = isManager
    ? {}
    : {
        OR: [
          { primaryAssigneeId: session.user.id },
          { backupAssigneeId: session.user.id },
        ],
      };

  // Count tasks by status for this week (tasks updated within this week or still active)
  const [todoCount, inProgressCount, doneThisWeek, todoLastWeek, inProgressLastWeek, doneLastWeek] =
    await Promise.all([
      // Current week: TODO count
      prisma.task.count({
        where: {
          ...assigneeFilter,
          status: "TODO",
        },
      }),
      // Current week: IN_PROGRESS count
      prisma.task.count({
        where: {
          ...assigneeFilter,
          status: "IN_PROGRESS",
        },
      }),
      // This week: tasks completed (status=DONE, updatedAt within this week)
      prisma.task.count({
        where: {
          ...assigneeFilter,
          status: "DONE",
          updatedAt: { gte: thisWeek.start, lte: thisWeek.end },
        },
      }),
      // Last week snapshots for trend comparison
      // We approximate by looking at tasks that were created before last week end
      // and had status at that time. Since we can't time-travel, we use:
      // - TODO last week: tasks currently TODO that were created before last week end
      prisma.task.count({
        where: {
          ...assigneeFilter,
          status: "TODO",
          createdAt: { lte: lastWeek.end },
        },
      }),
      prisma.task.count({
        where: {
          ...assigneeFilter,
          status: "IN_PROGRESS",
          createdAt: { lte: lastWeek.end },
        },
      }),
      // Last week completed
      prisma.task.count({
        where: {
          ...assigneeFilter,
          status: "DONE",
          updatedAt: { gte: lastWeek.start, lte: lastWeek.end },
        },
      }),
    ]);

  function trend(current: number, previous: number): "up" | "down" | "same" {
    if (current > previous) return "up";
    if (current < previous) return "down";
    return "same";
  }

  return success({
    todo: {
      count: todoCount,
      trend: trend(todoCount, todoLastWeek),
      diff: todoCount - todoLastWeek,
    },
    inProgress: {
      count: inProgressCount,
      trend: trend(inProgressCount, inProgressLastWeek),
      diff: inProgressCount - inProgressLastWeek,
    },
    done: {
      count: doneThisWeek,
      trend: trend(doneThisWeek, doneLastWeek),
      diff: doneThisWeek - doneLastWeek,
    },
    scope: isManager ? "team" : "personal",
  });
});
