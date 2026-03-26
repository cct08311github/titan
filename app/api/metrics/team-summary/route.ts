/**
 * GET /api/metrics/team-summary — Team summary for Manager/Admin (Issue #819)
 *
 * Returns: per-member task counts, overdue counts, weekly hours.
 * Only accessible by MANAGER/ADMIN roles.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";

export const GET = withManager(async (_req: NextRequest) => {
  const now = new Date();

  // Get all active users
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true, avatar: true },
    orderBy: { name: "asc" },
  });

  // Get task counts per user
  const memberSummaries = await Promise.all(
    users.map(async (user) => {
      const [taskCount, overdueCount, weeklyHours] = await Promise.all([
        // Active tasks (TODO + IN_PROGRESS)
        prisma.task.count({
          where: {
            primaryAssigneeId: user.id,
            status: { in: ["TODO", "IN_PROGRESS"] },
          },
        }),
        // Overdue tasks
        prisma.task.count({
          where: {
            primaryAssigneeId: user.id,
            status: { notIn: ["DONE"] },
            dueDate: { lt: now },
          },
        }),
        // Weekly hours (current week)
        prisma.timeEntry.aggregate({
          where: {
            userId: user.id,
            date: {
              gte: getMonday(now),
              lte: getSunday(now),
            },
          },
          _sum: { hours: true },
        }),
      ]);

      return {
        userId: user.id,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        taskCount,
        overdueCount,
        weeklyHours: weeklyHours._sum.hours ?? 0,
      };
    })
  );

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
