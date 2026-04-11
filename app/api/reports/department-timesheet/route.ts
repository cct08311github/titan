/**
 * GET /api/reports/department-timesheet — Department timesheet report (TS-26)
 *
 * Returns team hours grouped by user and day for a given date range.
 * Only MANAGER role may access.
 *
 * Query params:
 *   weekStart — ISO date string for the start of the week (required)
 *   userId    — optional, filter to a specific user
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withManager } from "@/lib/auth-middleware";
import { requireRole } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { formatLocalDate } from "@/lib/utils/date";

interface UserDayHours {
  [date: string]: number;
}

interface ByUserEntry {
  userId: string;
  userName: string;
  totalHours: number;
  byDay: UserDayHours;
}

export const GET = withManager(async (req: NextRequest) => {
  await requireRole("MANAGER");

  const { searchParams } = new URL(req.url);
  const weekStart = searchParams.get("weekStart");
  const filterUserId = searchParams.get("userId");

  const start = weekStart ? new Date(weekStart) : new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const where: Record<string, unknown> = {
    date: { gte: start, lte: end },
  };
  if (filterUserId) {
    where.userId = filterUserId;
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    include: {
      user: { select: { id: true, name: true } },
      task: { select: { id: true, title: true, category: true } },
    },
    orderBy: [{ date: "asc" }],
  });

  // Group by user and day
  const byUserMap = new Map<string, ByUserEntry>();

  for (const entry of entries) {
    const userId = entry.userId;
    const userName = entry.user?.name ?? "Unknown";
    const dateStr = formatLocalDate(new Date(entry.date));

    if (!byUserMap.has(userId)) {
      byUserMap.set(userId, {
        userId,
        userName,
        totalHours: 0,
        byDay: {},
      });
    }

    const userEntry = byUserMap.get(userId)!;
    userEntry.totalHours += Number(entry.hours);
    userEntry.byDay[dateStr] = (userEntry.byDay[dateStr] ?? 0) + Number(entry.hours);
  }

  const byUser = Object.fromEntries(byUserMap);
  const grandTotal = entries.reduce((sum, e) => sum + Number(e.hours), 0);

  return success({
    weekStart: formatLocalDate(start),
    weekEnd: formatLocalDate(end),
    grandTotal,
    byUser,
    entries,
  });
});
