/**
 * Completion rate calculation utilities — R-1 (#836)
 *
 * Computes task completion rate (completed/total * 100%) aggregated
 * by week or month. Empty periods return 0% (no gaps in the line chart).
 *
 * Week bounds follow Asia/Taipei Monday–Sunday convention.
 */

import { PrismaClient } from "@prisma/client";

export interface CompletionRatePoint {
  label: string;
  periodStart: string;
  periodEnd: string;
  completedCount: number;
  totalCount: number;
  completionRate: number;
}

/** Get Monday 00:00 of the week containing `date`. */
export function getWeekBounds(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMon);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(start: Date): string {
  const m = start.getMonth() + 1;
  const d = start.getDate();
  return `${m}/${d}`;
}

function formatMonthLabel(year: number, month: number): string {
  return `${year}/${String(month).padStart(2, "0")}`;
}

/**
 * Generate weekly period buckets between startDate and endDate.
 */
function generateWeekBuckets(startDate: Date, endDate: Date): Array<{ start: Date; end: Date; label: string }> {
  const buckets: Array<{ start: Date; end: Date; label: string }> = [];
  let { start } = getWeekBounds(startDate);

  while (start <= endDate) {
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    buckets.push({ start: new Date(start), end, label: formatWeekLabel(start) });
    start = new Date(start);
    start.setDate(start.getDate() + 7);
  }
  return buckets;
}

/**
 * Generate monthly period buckets between startDate and endDate.
 */
function generateMonthBuckets(startDate: Date, endDate: Date): Array<{ start: Date; end: Date; label: string }> {
  const buckets: Array<{ start: Date; end: Date; label: string }> = [];
  let year = startDate.getFullYear();
  let month = startDate.getMonth(); // 0-based

  while (true) {
    const start = new Date(year, month, 1, 0, 0, 0, 0);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    if (start > endDate) break;
    buckets.push({ start, end, label: formatMonthLabel(year, month + 1) });
    month++;
    if (month > 11) { month = 0; year++; }
  }
  return buckets;
}

/**
 * Query and compute completion rate data points.
 *
 * For each period bucket:
 * - totalCount = tasks that existed in the period (created before period end, with due date in period OR active in period)
 * - completedCount = tasks marked DONE within the period
 * - completionRate = completedCount / totalCount * 100 (0% when totalCount is 0)
 */
export async function getCompletionRateData(
  prisma: PrismaClient,
  startDate: Date,
  endDate: Date,
  granularity: "week" | "month",
  userFilter: { primaryAssigneeId?: string },
): Promise<CompletionRatePoint[]> {
  const buckets = granularity === "week"
    ? generateWeekBuckets(startDate, endDate)
    : generateMonthBuckets(startDate, endDate);

  // Fetch all tasks in the full date range in one query for performance
  const allTasks = await prisma.task.findMany({
    where: {
      ...userFilter,
      createdAt: { lte: endDate },
      OR: [
        { dueDate: { gte: startDate, lte: endDate } },
        { status: "DONE", updatedAt: { gte: startDate, lte: endDate } },
      ],
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      dueDate: true,
    },
  });

  return buckets.map((bucket) => {
    // Tasks relevant to this period: created before period end AND
    // (has dueDate in period OR was completed in period)
    const periodTasks = allTasks.filter((t) => {
      const created = new Date(t.createdAt);
      if (created > bucket.end) return false;
      const due = t.dueDate ? new Date(t.dueDate) : null;
      const updated = new Date(t.updatedAt);
      const dueInPeriod = due && due >= bucket.start && due <= bucket.end;
      const doneInPeriod = t.status === "DONE" && updated >= bucket.start && updated <= bucket.end;
      return dueInPeriod || doneInPeriod;
    });

    const completedCount = periodTasks.filter((t) => {
      if (t.status !== "DONE") return false;
      const updated = new Date(t.updatedAt);
      return updated >= bucket.start && updated <= bucket.end;
    }).length;

    const totalCount = periodTasks.length;
    const completionRate = totalCount > 0
      ? Math.round((completedCount / totalCount) * 1000) / 10
      : 0;

    return {
      label: bucket.label,
      periodStart: formatDateStr(bucket.start),
      periodEnd: formatDateStr(bucket.end),
      completedCount,
      totalCount,
      completionRate,
    };
  });
}
