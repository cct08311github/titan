/**
 * GET /api/time-entries/monthly-summary?month=2026-03
 *
 * Returns monthly summary statistics for managers.
 * MANAGER only — Issue #851 (Phase 2).
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withManager } from "@/lib/auth-middleware";
import { requireRole } from "@/lib/rbac";
import { success, error } from "@/lib/api-response";
import { formatLocalDate } from "@/lib/utils/date";

const monthParamSchema = z.string().regex(/^\d{4}-\d{2}$/, "格式須為 YYYY-MM");

/**
 * Count workdays (Mon–Fri) in a given month.
 */
function countWorkdays(year: number, month: number): number {
  const lastDay = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

/**
 * Check if a date is a weekend (Saturday or Sunday).
 */
function isWeekend(date: Date): boolean {
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

export const GET = withManager(async (req: NextRequest) => {
  await requireRole("MANAGER");

  const { searchParams } = new URL(req.url);
  const monthRaw = searchParams.get("month");

  const monthResult = monthParamSchema.safeParse(monthRaw);
  if (!monthResult.success) {
    return error("ValidationError", "month 參數格式須為 YYYY-MM", 400) as never;
  }
  const month = monthResult.data;

  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const mon = parseInt(monthStr, 10);
  const startDate = new Date(year, mon - 1, 1);
  const endDate = new Date(year, mon, 0);

  const workdays = countWorkdays(year, mon);
  const daysInMonth = endDate.getDate();

  // Get all active users
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Get all time entries for the month
  const entries = await prisma.timeEntry.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
    },
  });

  // Pre-build a Map for O(1) per-user entry lookup instead of O(N×M) filtering
  const entriesByUser = new Map<string, typeof entries>();
  for (const entry of entries) {
    const list = entriesByUser.get(entry.userId) ?? [];
    list.push(entry);
    entriesByUser.set(entry.userId, list);
  }

  // Per-member stats
  const memberStats = users.map((user) => {
    const userEntries = entriesByUser.get(user.id) ?? [];

    // Total hours, overtime breakdown, and approval counts in a single pass
    let totalHours = 0;
    let weekdayOvertime = 0;
    let holidayOvertime = 0;
    const approval = { pending: 0, approved: 0, rejected: 0 };
    const datesWithEntries = new Set<string>();

    for (const e of userEntries) {
      totalHours += e.hours;
      if (e.overtimeType === "WEEKDAY") weekdayOvertime += e.hours;
      else if (e.overtimeType === "HOLIDAY") holidayOvertime += e.hours;

      const status = (e as Record<string, unknown>).approvalStatus;
      if (status === "PENDING") approval.pending++;
      else if (status === "APPROVED") approval.approved++;
      else if (status === "REJECTED") approval.rejected++;

      datesWithEntries.add(formatLocalDate(e.date));
    }

    // Missing workdays (no entries filed)
    const missingDays: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, mon - 1, d);
      if (isWeekend(date)) continue;
      const dateStr = formatLocalDate(date);
      if (!datesWithEntries.has(dateStr)) {
        missingDays.push(dateStr);
      }
    }

    return {
      userId: user.id,
      name: user.name,
      totalHours,
      expectedHours: workdays * 8,
      weekdayOvertime,
      holidayOvertime,
      totalOvertime: weekdayOvertime + holidayOvertime,
      missingDays,
      missingDayCount: missingDays.length,
      approval: { ...approval, total: userEntries.length },
    };
  });

  // Team totals
  const teamOvertime = {
    weekday: memberStats.reduce((sum, m) => sum + m.weekdayOvertime, 0),
    holiday: memberStats.reduce((sum, m) => sum + m.holidayOvertime, 0),
    total: memberStats.reduce((sum, m) => sum + m.totalOvertime, 0),
  };

  // Overtime ranking (desc by total overtime)
  const overtimeRanking = [...memberStats]
    .filter((m) => m.totalOvertime > 0)
    .sort((a, b) => b.totalOvertime - a.totalOvertime)
    .map((m, i) => ({
      rank: i + 1,
      userId: m.userId,
      name: m.name,
      totalOvertime: m.totalOvertime,
    }));

  // Approval progress
  const approvalProgress = {
    pending: memberStats.reduce((sum, m) => sum + m.approval.pending, 0),
    approved: memberStats.reduce((sum, m) => sum + m.approval.approved, 0),
    rejected: memberStats.reduce((sum, m) => sum + m.approval.rejected, 0),
    total: memberStats.reduce((sum, m) => sum + m.approval.total, 0),
  };

  return success({
    month,
    workdays,
    daysInMonth,
    expectedHoursPerMember: workdays * 8,
    teamOvertime,
    overtimeRanking,
    approvalProgress,
    members: memberStats,
  });
});
