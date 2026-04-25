/**
 * GET /api/time-entries/top-tasks — Issue #1539-4 (from #1538 audit)
 *
 * Returns the user's most-frequent tasks over the recent window so the
 * timesheet UI can suggest "你最常做的事 — 一鍵套用今天 1h" entries.
 *
 * Why this exists separately from /api/time-entries/suggestions:
 *   - suggestions returns today's status-change-driven hints (real-time)
 *   - top-tasks returns historical-frequency-driven hints (Monday morning recall)
 *
 * Query params:
 *   days  — lookback window in days (default 14, max 60)
 *   limit — number of tasks (default 5, max 10)
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";

export interface TopTask {
  taskId: string;
  taskTitle: string;
  category: string;
  totalHours: number;
  entryCount: number;
  avgHoursPerEntry: number;
  lastEntryDate: string;
}

const DEFAULT_DAYS = 14;
const MAX_DAYS = 60;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const daysParam = parseInt(searchParams.get("days") ?? "", 10);
  const limitParam = parseInt(searchParams.get("limit") ?? "", 10);

  const days = Number.isFinite(daysParam) && daysParam > 0
    ? Math.min(daysParam, MAX_DAYS)
    : DEFAULT_DAYS;
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, MAX_LIMIT)
    : DEFAULT_LIMIT;

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  // Pull user's recent entries; cap at 5000 for safety (1500 entries * 100 days = unlikely).
  const entries = await prisma.timeEntry.findMany({
    where: {
      userId,
      isDeleted: false,
      taskId: { not: null },
      date: { gte: since },
    },
    select: {
      taskId: true,
      hours: true,
      date: true,
      task: { select: { id: true, title: true, category: true } },
    },
    orderBy: { date: "desc" },
    take: 5000,
  });

  // Aggregate by taskId
  const acc = new Map<string, {
    taskId: string;
    taskTitle: string;
    category: string;
    totalHours: number;
    entryCount: number;
    lastEntryDate: Date;
  }>();

  for (const e of entries) {
    if (!e.taskId || !e.task) continue;
    const existing = acc.get(e.taskId);
    // Issue #1538: hours can be Prisma Decimal as string over the wire — coerce.
    const hrs = Number(e.hours ?? 0);
    if (existing) {
      existing.totalHours += hrs;
      existing.entryCount += 1;
      if (e.date > existing.lastEntryDate) existing.lastEntryDate = e.date;
    } else {
      acc.set(e.taskId, {
        taskId: e.taskId,
        taskTitle: e.task.title,
        category: e.task.category,
        totalHours: hrs,
        entryCount: 1,
        lastEntryDate: e.date,
      });
    }
  }

  // Sort by totalHours desc, take top N
  const sorted = Array.from(acc.values())
    .sort((a, b) => b.totalHours - a.totalHours)
    .slice(0, limit);

  const result: TopTask[] = sorted.map((t) => ({
    taskId: t.taskId,
    taskTitle: t.taskTitle,
    category: t.category,
    totalHours: Math.round(t.totalHours * 10) / 10,
    entryCount: t.entryCount,
    avgHoursPerEntry: t.entryCount > 0
      ? Math.round((t.totalHours / t.entryCount) * 10) / 10
      : 0,
    lastEntryDate: t.lastEntryDate.toISOString().split("T")[0],
  }));

  return success({
    items: result,
    windowDays: days,
  });
});
