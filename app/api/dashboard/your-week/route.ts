/**
 * GET /api/dashboard/your-week — Issue #1518 (Phase 3 of #1505)
 *
 * Returns a personal weekly summary for the dashboard widget:
 *  - completed tasks this week vs last week
 *  - hours logged this week vs last week
 *  - active days this week (distinct days with at least one task action or
 *    time entry — capped at 7)
 *  - KPI achievement average % across the user's active KPIs
 *
 * Frame is positive only — no leaderboard, no negative comparison. Just a
 * "your week" snapshot, by design (see #1505 principles).
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";

/** Returns local-time Monday 00:00 of the week containing `date`. */
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type SummaryRange = { from: Date; to: Date };

/** Count "completed" task activities by user in the given range. */
async function countCompletedTasks(userId: string, range: SummaryRange) {
  return prisma.taskActivity.count({
    where: {
      userId,
      action: { in: ["COMPLETE", "STATUS_CHANGE_DONE", "DONE"] },
      createdAt: { gte: range.from, lt: range.to },
    },
  });
}

/** Sum hours logged by user in the given range. Decimal → number. */
async function sumLoggedHours(userId: string, range: SummaryRange): Promise<number> {
  const fromDate = toDateString(range.from);
  const toDate = toDateString(range.to);
  const rows = await prisma.timeEntry.findMany({
    where: {
      userId,
      date: { gte: new Date(fromDate), lt: new Date(toDate) },
    },
    select: { hours: true },
  });
  let total = 0;
  for (const r of rows) {
    total += Number(r.hours);
  }
  return Math.round(total * 10) / 10;
}

/** Distinct days with at least one user action in the given range. */
async function countActiveDays(userId: string, range: SummaryRange): Promise<number> {
  const [activities, entries] = await Promise.all([
    prisma.taskActivity.findMany({
      where: { userId, createdAt: { gte: range.from, lt: range.to } },
      select: { createdAt: true },
    }),
    prisma.timeEntry.findMany({
      where: {
        userId,
        date: { gte: new Date(toDateString(range.from)), lt: new Date(toDateString(range.to)) },
      },
      select: { date: true },
    }),
  ]);
  const days = new Set<string>();
  for (const a of activities) days.add(toDateString(a.createdAt));
  for (const e of entries) days.add(toDateString(e.date));
  return Math.min(days.size, 7);
}

/** Average achievement % across the user's ACTIVE KPIs (capped at 100). */
async function averageActiveKpiPct(userId: string): Promise<{ averagePct: number; hasActive: boolean }> {
  const kpis = await prisma.kPI.findMany({
    where: { createdBy: userId, status: "ACTIVE", deletedAt: null },
    select: { target: true, actual: true },
  });
  if (kpis.length === 0) return { averagePct: 0, hasActive: false };
  let total = 0;
  for (const k of kpis) {
    if (k.target <= 0) continue;
    const pct = Math.min(100, (k.actual / k.target) * 100);
    total += pct;
  }
  return {
    averagePct: Math.round(total / kpis.length),
    hasActive: true,
  };
}

export const GET = withAuth(async (_req: NextRequest) => {
  const session = await requireAuth();
  const userId = session.user.id;

  const now = new Date();
  const thisWeekStart = startOfWeek(now);
  const thisWeekEnd = addDays(thisWeekStart, 7);
  const lastWeekStart = addDays(thisWeekStart, -7);

  const [
    currentCompleted,
    previousCompleted,
    currentHours,
    previousHours,
    activeDays,
    kpi,
  ] = await Promise.all([
    countCompletedTasks(userId, { from: thisWeekStart, to: thisWeekEnd }),
    countCompletedTasks(userId, { from: lastWeekStart, to: thisWeekStart }),
    sumLoggedHours(userId, { from: thisWeekStart, to: thisWeekEnd }),
    sumLoggedHours(userId, { from: lastWeekStart, to: thisWeekStart }),
    countActiveDays(userId, { from: thisWeekStart, to: thisWeekEnd }),
    averageActiveKpiPct(userId),
  ]);

  return success({
    weekStart: toDateString(thisWeekStart),
    completedTasks: {
      current: currentCompleted,
      previous: previousCompleted,
      delta: currentCompleted - previousCompleted,
    },
    hoursLogged: {
      current: currentHours,
      previous: previousHours,
      delta: Math.round((currentHours - previousHours) * 10) / 10,
    },
    activeDays,
    kpiAchievement: kpi,
  });
});
