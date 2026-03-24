import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";

export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const refDate = dateParam ? new Date(dateParam) : new Date();

  // Week bounds: Monday–Sunday
  const day = refDate.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(refDate);
  weekStart.setDate(refDate.getDate() + diffToMon);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const isManager = session.user.role === "MANAGER";
  const userFilter = isManager ? {} : { primaryAssigneeId: session.user.id };

  const completedTasks = await prisma.task.findMany({
    where: {
      ...userFilter,
      status: "DONE",
      updatedAt: { gte: weekStart, lte: weekEnd },
    },
    include: { primaryAssignee: { select: { id: true, name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const timeEntryFilter = isManager
    ? { date: { gte: weekStart, lte: weekEnd } }
    : { userId: session.user.id, date: { gte: weekStart, lte: weekEnd } };

  const timeEntries = await prisma.timeEntry.findMany({
    where: timeEntryFilter,
    include: { user: { select: { id: true, name: true } } },
  });

  const totalHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);
  const hoursByCategory = timeEntries.reduce(
    (acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.hours;
      return acc;
    },
    {} as Record<string, number>
  );

  const overdueTasks = await prisma.task.findMany({
    where: {
      ...userFilter,
      status: { notIn: ["DONE"] },
      dueDate: { lt: new Date() },
    },
    include: { primaryAssignee: { select: { id: true, name: true } } },
    orderBy: { dueDate: "asc" },
    take: 10,
  });

  const changes = await prisma.taskChange.findMany({
    where: { changedAt: { gte: weekStart, lte: weekEnd } },
    include: {
      task: { select: { id: true, title: true } },
      changedByUser: { select: { id: true, name: true } },
    },
    orderBy: { changedAt: "desc" },
  });

  return success({
    period: { start: weekStart, end: weekEnd },
    completedTasks,
    completedCount: completedTasks.length,
    totalHours,
    hoursByCategory,
    overdueTasks,
    overdueCount: overdueTasks.length,
    changes,
    delayCount: changes.filter((c) => c.changeType === "DELAY").length,
    scopeChangeCount: changes.filter((c) => c.changeType === "SCOPE_CHANGE").length,
  });
});
