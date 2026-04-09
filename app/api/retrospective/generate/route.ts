import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";
import { ValidationError } from "@/services/errors";

/**
 * GET /api/retrospective/generate?month=2026-03 — Issue #969
 *
 * Auto-generates a monthly retrospective summary from:
 * - Completed tasks in the given month
 * - Time entries logged
 * - Activity log highlights
 */
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new ValidationError("請提供有效的月份格式（YYYY-MM）");
  }

  const startDate = new Date(`${month}-01T00:00:00.000Z`);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);

  // 1. Completed tasks
  const completedTasks = await prisma.task.findMany({
    where: {
      isSample: false,
      status: "DONE",
      updatedAt: { gte: startDate, lt: endDate },
    },
    include: {
      primaryAssignee: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "asc" },
  });

  // 2. Time summary per user (exclude soft-deleted — T1361 followup)
  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      date: { gte: startDate, lt: endDate },
      isDeleted: false,
    },
    select: {
      userId: true,
      hours: true,
      user: { select: { id: true, name: true } },
    },
    take: 10000, // safety cap for large team retrospectives
  });

  const timeByUser: Record<string, { name: string; totalHours: number }> = {};
  for (const entry of timeEntries) {
    if (!timeByUser[entry.userId]) {
      timeByUser[entry.userId] = { name: entry.user.name, totalHours: 0 };
    }
    timeByUser[entry.userId].totalHours += Number(entry.hours);
  }

  // 3. Task category breakdown
  const categoryBreakdown: Record<string, number> = {};
  for (const task of completedTasks) {
    const cat = task.category ?? "OTHER";
    categoryBreakdown[cat] = (categoryBreakdown[cat] ?? 0) + 1;
  }

  // 4. Priority breakdown
  const priorityBreakdown: Record<string, number> = {};
  for (const task of completedTasks) {
    const pri = task.priority ?? "P2";
    priorityBreakdown[pri] = (priorityBreakdown[pri] ?? 0) + 1;
  }

  // 5. Top contributors (by completed tasks)
  const contributorMap: Record<string, { name: string; count: number }> = {};
  for (const task of completedTasks) {
    if (task.primaryAssignee) {
      const uid = task.primaryAssignee.id;
      if (!contributorMap[uid]) {
        contributorMap[uid] = { name: task.primaryAssignee.name, count: 0 };
      }
      contributorMap[uid].count++;
    }
  }
  const topContributors = Object.values(contributorMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Build summary
  const summary = {
    month,
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    completedTaskCount: completedTasks.length,
    totalHoursLogged: Object.values(timeByUser).reduce((sum, u) => sum + u.totalHours, 0),
    teamSize: Object.keys(timeByUser).length,
    categoryBreakdown,
    priorityBreakdown,
    topContributors,
    timeByUser: Object.values(timeByUser).sort((a, b) => b.totalHours - a.totalHours),
    recentCompletions: completedTasks.slice(-10).map((t) => ({
      id: t.id,
      title: t.title,
      assignee: t.primaryAssignee?.name ?? "未指派",
      completedAt: t.updatedAt,
    })),
  };

  return success(summary);
});
