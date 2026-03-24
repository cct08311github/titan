import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { ForbiddenError, UnauthorizedError } from "@/services/errors";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";

const READ_ALL_ROLES = new Set(["MANAGER", "ADMIN"]);

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const callerId = session.user.id;
  const callerRole = session.user.role ?? "ENGINEER";

  const { searchParams } = new URL(req.url);
  const requestedUserId = searchParams.get("userId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  // IDOR: non-privileged callers can only query their own stats.
  if (requestedUserId && requestedUserId !== callerId && !READ_ALL_ROLES.has(callerRole)) {
    throw new ForbiddenError("其他使用者的統計資料無法存取");
  }

  // Scope to caller unless a privileged role requests a specific user.
  const userId = READ_ALL_ROLES.has(callerRole) && requestedUserId
    ? requestedUserId
    : callerId;

  const where: Record<string, unknown> = { userId };
  if (startDate || endDate) {
    where.date = {};
    if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate);
    if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate);
  }

  const entries = await prisma.timeEntry.findMany({ where });

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);

  const byCategory: Record<string, number> = {};
  for (const e of entries) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.hours;
  }

  const categories = [
    "PLANNED_TASK",
    "ADDED_TASK",
    "INCIDENT",
    "SUPPORT",
    "ADMIN",
    "LEARNING",
  ];

  const breakdown = categories.map((cat) => ({
    category: cat,
    hours: byCategory[cat] ?? 0,
    pct: totalHours > 0 ? Math.round(((byCategory[cat] ?? 0) / totalHours) * 100) : 0,
  }));

  const plannedHours = byCategory["PLANNED_TASK"] ?? 0;
  const taskInvestmentRate = totalHours > 0
    ? Math.round((plannedHours / totalHours) * 100)
    : 0;

  return success({
    totalHours,
    breakdown,
    taskInvestmentRate,
    entryCount: entries.length,
  });
});
