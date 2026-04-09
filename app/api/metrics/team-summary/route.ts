/**
 * GET /api/metrics/team-summary — Team summary for Manager/Admin (Issue #819)
 *
 * Returns: per-member task counts, overdue counts, weekly hours.
 * Only accessible by MANAGER/ADMIN roles.
 *
 * Issue #1327: Replaced N+1 (1 + 3×N queries) with 3 bulk groupBy queries.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";

export const GET = withManager(async (_req: NextRequest) => {
  const now = new Date();
  const monday = getMonday(now);
  const sunday = getSunday(now);

  // Query 1: all active users
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true, avatar: true },
    orderBy: { name: "asc" },
  });

  // Query 2: active task counts grouped by primaryAssigneeId
  const taskCounts = await prisma.task.groupBy({
    by: ["primaryAssigneeId"],
    where: {
      primaryAssigneeId: { in: users.map((u) => u.id) },
      status: { in: ["TODO", "IN_PROGRESS"] },
      isSample: false,
    },
    _count: { _all: true },
  });

  // Query 3: overdue task counts grouped by primaryAssigneeId
  const overdueCounts = await prisma.task.groupBy({
    by: ["primaryAssigneeId"],
    where: {
      primaryAssigneeId: { in: users.map((u) => u.id) },
      status: { notIn: ["DONE"] },
      dueDate: { lt: now },
      isSample: false,
    },
    _count: { _all: true },
  });

  // Query 4: weekly hours grouped by userId
  const weeklyHoursRows = await prisma.timeEntry.groupBy({
    by: ["userId"],
    where: {
      userId: { in: users.map((u) => u.id) },
      date: { gte: monday, lte: sunday },
    },
    _sum: { hours: true },
  });

  // Build lookup maps
  const taskCountMap = new Map<string, number>(
    taskCounts.map((r) => [r.primaryAssigneeId as string, r._count._all])
  );
  const overdueCountMap = new Map<string, number>(
    overdueCounts.map((r) => [r.primaryAssigneeId as string, r._count._all])
  );
  const weeklyHoursMap = new Map<string, number>(
    weeklyHoursRows.map((r) => [r.userId, r._sum.hours ?? 0])
  );

  const memberSummaries = users.map((user) => ({
    userId: user.id,
    name: user.name,
    role: user.role,
    avatar: user.avatar,
    taskCount: taskCountMap.get(user.id) ?? 0,
    overdueCount: overdueCountMap.get(user.id) ?? 0,
    weeklyHours: weeklyHoursMap.get(user.id) ?? 0,
  }));

  return success({
    members: memberSummaries,
    totalMembers: users.length,
  });
});

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getSunday(date: Date): Date {
  const monday = getMonday(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}
