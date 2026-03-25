import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { NotFoundError, ForbiddenError } from "@/services/errors";

// Standard working hours per month used for load percentage calculation
const STANDARD_MONTHLY_HOURS = 160;

export const GET = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;

  // Members can only view their own workload; managers can view any
  if (session.user.role !== "MANAGER" && session.user.id !== id) {
    throw new ForbiddenError("無法查看其他使用者的工作負荷");
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError("找不到使用者");
  }

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

  // Compute start of the current ISO week (Monday) for weeklyHours
  const weekStart = new Date(now);
  const dayOfWeek = weekStart.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  weekStart.setDate(weekStart.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);

  // Active tasks (exclude DONE) assigned to this user
  const [activeTasks, timeEntries, weeklyTimeAgg] = await Promise.all([
    prisma.task.findMany({
      where: {
        primaryAssigneeId: id,
        status: { notIn: ["DONE"] },
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        category: true,
        estimatedHours: true,
        dueDate: true,
      },
    }),
    // Time entries within the requested date range
    prisma.timeEntry.findMany({
      where: {
        userId: id,
        date: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        hours: true,
        category: true,
        date: true,
      },
    }),
    // Aggregate weekly hours for the current week
    prisma.timeEntry.aggregate({
      where: {
        userId: id,
        date: { gte: weekStart },
      },
      _sum: { hours: true },
    }),
  ]);

  const taskCount = activeTasks.length;
  const totalHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);
  const estimatedHours = activeTasks.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0);
  const loadPct = Math.round((totalHours / STANDARD_MONTHLY_HOURS) * 100 * 10) / 10;

  // Spec-required fields: unplannedRatio and weeklyHours (Issue #287)
  const unplannedCount = activeTasks.filter(
    (t) => ["ADDED", "INCIDENT", "SUPPORT"].includes(t.category)
  ).length;
  const unplannedRatio = taskCount > 0 ? Math.round((unplannedCount / taskCount) * 100 * 10) / 10 : 0;
  const weeklyHours = weeklyTimeAgg._sum.hours ?? 0;

  return success({
    userId: id,
    userName: user.name,
    period: { start: startDate, end: endDate },
    taskCount,
    totalHours,
    estimatedHours,
    loadPct,
    unplannedRatio,
    weeklyHours,
    activeTasks,
  });
});
