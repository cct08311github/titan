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

  // Active tasks (exclude DONE) assigned to this user
  const activeTasks = await prisma.task.findMany({
    where: {
      primaryAssigneeId: id,
      status: { notIn: ["DONE"] },
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      estimatedHours: true,
      dueDate: true,
    },
  });

  // Time entries within the date range
  const timeEntries = await prisma.timeEntry.findMany({
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
  });

  const taskCount = activeTasks.length;
  const totalHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);
  const estimatedHours = activeTasks.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0);
  const loadPct = Math.round((totalHours / STANDARD_MONTHLY_HOURS) * 100 * 10) / 10;

  return success({
    userId: id,
    userName: user.name,
    period: { start: startDate, end: endDate },
    taskCount,
    totalHours,
    estimatedHours,
    loadPct,
    activeTasks,
  });
});
