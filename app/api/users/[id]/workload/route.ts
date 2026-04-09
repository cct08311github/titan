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
    throw new ForbiddenError("\u7121\u6cd5\u67e5\u770b\u5176\u4ed6\u4f7f\u7528\u8005\u7684\u5de5\u4f5c\u8ca0\u8377");
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new NotFoundError("\u627e\u4e0d\u5230\u4f7f\u7528\u8005");
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
      isSample: false,
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

  // Time entries within the date range (exclude soft-deleted — T1361 followup)
  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      userId: id,
      date: { gte: startDate, lte: endDate },
      isDeleted: false,
    },
    select: {
      id: true,
      hours: true,
      category: true,
      date: true,
    },
    take: 2000, // safety cap — typical user has ~200/month
  });

  const taskCount = activeTasks.length;
  const totalHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);
  const estimatedHours = activeTasks.reduce(
    (sum, t) => sum + (t.estimatedHours ?? 0),
    0
  );
  const loadPct =
    Math.round((totalHours / STANDARD_MONTHLY_HOURS) * 100 * 10) / 10;

  // Unplanned ratio calculation
  const plannedHours = timeEntries
    .filter((e) => e.category === "PLANNED_TASK")
    .reduce((sum, e) => sum + e.hours, 0);
  const unplannedHours = timeEntries
    .filter((e) =>
      ["ADDED_TASK", "INCIDENT", "SUPPORT"].includes(e.category)
    )
    .reduce((sum, e) => sum + e.hours, 0);
  const unplannedRatio =
    totalHours > 0
      ? Math.round((unplannedHours / totalHours) * 1000) / 1000
      : 0;

  // Weekly hours for current week
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weeklyHours = timeEntries
    .filter((e) => new Date(e.date) >= weekStart)
    .reduce((sum, e) => sum + e.hours, 0);

  return success({
    userId: id,
    userName: user.name,
    period: { start: startDate, end: endDate },
    taskCount,
    totalHours,
    plannedHours,
    unplannedHours,
    unplannedRatio,
    estimatedHours,
    loadPct,
    weeklyHours,
    activeTasks,
  });
});
