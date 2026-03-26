import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";

export const GET = withManager(async (_req: NextRequest) => {
  const now = new Date();
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true, avatar: true },
    orderBy: { name: "asc" },
  });

  const d = new Date(now); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff); d.setHours(0, 0, 0, 0); const monday = new Date(d);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23, 59, 59, 999);

  const members = await Promise.all(users.map(async (user) => {
    const [taskCount, overdueCount, weeklyHours] = await Promise.all([
      prisma.task.count({ where: { primaryAssigneeId: user.id, status: { in: ["TODO", "IN_PROGRESS"] } } }),
      prisma.task.count({ where: { primaryAssigneeId: user.id, status: { notIn: ["DONE"] }, dueDate: { lt: now } } }),
      prisma.timeEntry.aggregate({ where: { userId: user.id, date: { gte: monday, lte: sunday } }, _sum: { hours: true } }),
    ]);
    return { userId: user.id, name: user.name, role: user.role, avatar: user.avatar, taskCount, overdueCount, weeklyHours: weeklyHours._sum.hours ?? 0 };
  }));

  return success({ members, totalMembers: users.length });
});
