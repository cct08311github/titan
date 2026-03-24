import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";

export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();

  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get("startDate");
  const endParam = searchParams.get("endDate");
  const now = new Date();

  const startDate = startParam
    ? new Date(startParam)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = endParam
    ? new Date(endParam)
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const isManager = session.user.role === "MANAGER";
  const timeEntryFilter = isManager
    ? { date: { gte: startDate, lte: endDate } }
    : { userId: session.user.id, date: { gte: startDate, lte: endDate } };

  const timeEntries = await prisma.timeEntry.findMany({
    where: timeEntryFilter,
    include: {
      user: { select: { id: true, name: true } },
      task: { select: { id: true, title: true, category: true } },
    },
  });

  const totalHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);
  const plannedHours = timeEntries
    .filter((e) => e.category === "PLANNED_TASK")
    .reduce((sum, e) => sum + e.hours, 0);
  const unplannedHours = timeEntries
    .filter((e) => ["ADDED_TASK", "INCIDENT", "SUPPORT"].includes(e.category))
    .reduce((sum, e) => sum + e.hours, 0);

  const hoursByCategory = timeEntries.reduce(
    (acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.hours;
      return acc;
    },
    {} as Record<string, number>
  );

  const byPerson = timeEntries.reduce(
    (acc, e) => {
      const key = e.userId;
      if (!acc[key]) {
        acc[key] = { userId: e.userId, name: e.user.name, total: 0, planned: 0, unplanned: 0 };
      }
      acc[key].total += e.hours;
      if (e.category === "PLANNED_TASK") acc[key].planned += e.hours;
      if (["ADDED_TASK", "INCIDENT", "SUPPORT"].includes(e.category)) acc[key].unplanned += e.hours;
      return acc;
    },
    {} as Record<string, { userId: string; name: string; total: number; planned: number; unplanned: number }>
  );

  const unplannedTasks = await prisma.task.findMany({
    where: {
      ...(isManager ? {} : { primaryAssigneeId: session.user.id }),
      category: { in: ["ADDED", "INCIDENT", "SUPPORT"] },
      createdAt: { gte: startDate, lte: endDate },
    },
    include: { primaryAssignee: { select: { id: true, name: true } } },
  });

  const unplannedBySource = unplannedTasks.reduce(
    (acc, t) => {
      const src = t.addedSource ?? "未填寫";
      acc[src] = (acc[src] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return success({
    period: { start: startDate, end: endDate },
    totalHours,
    plannedHours,
    unplannedHours,
    plannedRate: totalHours > 0 ? Math.round((plannedHours / totalHours) * 100 * 10) / 10 : 0,
    unplannedRate: totalHours > 0 ? Math.round((unplannedHours / totalHours) * 100 * 10) / 10 : 0,
    hoursByCategory,
    byPerson: Object.values(byPerson),
    unplannedTasks,
    unplannedBySource,
  });
});
