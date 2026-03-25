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
    const userName = (entry as unknown as { user: { name: string } }).user?.name ?? "Unknown";
    const dateStr = new Date(entry.date).toISOString().slice(0, 10);

    if (!byUserMap.has(userId)) {
      byUserMap.set(userId, {
        userId,
        userName,
        totalHours: 0,
        byDay: {},
      });
    }

    const userEntry = byUserMap.get(userId)!;
    userEntry.totalHours += entry.hours;
    userEntry.byDay[dateStr] = (userEntry.byDay[dateStr] ?? 0) + entry.hours;
  }

  const byUser = Object.fromEntries(byUserMap);
  const grandTotal = entries.reduce((sum, e) => sum + e.hours, 0);

  return success({
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: end.toISOString().slice(0, 10),
    grandTotal,
    byUser,
    entries,
  });
});
