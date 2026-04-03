/**
 * GET /api/reports/time-summary — Issue #1161 (HR Grade)
 *
 * Returns per-user time summary with category breakdown,
 * workday count, target hours, and utilization rate.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManagerOrAbove as requireManager } from "@/lib/auth";
import { success, error } from "@/lib/api-response";

const HOURS_PER_DAY = 8;

function countWorkdays(from: Date, to: Date): number {
  let count = 0;
  const d = new Date(from);
  while (d <= to) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export async function GET(req: NextRequest) {
  try { await requireManager(); } catch { return error("ForbiddenError", "權限不足", 403); }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const toDate = to ? new Date(to) : new Date();
  const workdays = countWorkdays(fromDate, toDate);
  const targetPerUser = workdays * HOURS_PER_DAY;

  const dateFilter = { gte: fromDate, lte: toDate };

  const entries = await prisma.timeEntry.groupBy({
    by: ["userId", "category"],
    where: { date: dateFilter },
    _sum: { hours: true },
  });

  // Get all active users (not just those with entries)
  const allUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true },
  });

  const CATS = ["PLANNED_TASK", "ADDED_TASK", "INCIDENT", "SUPPORT", "ADMIN", "LEARNING"] as const;

  const users = allUsers.map((u) => {
    const userEntries = entries.filter((e) => e.userId === u.id);
    const byCategory = Object.fromEntries(CATS.map((c) => [c, 0]));
    let total = 0;
    for (const e of userEntries) {
      const h = Number(e._sum.hours ?? 0);
      if (byCategory[e.category as string] !== undefined) byCategory[e.category as string] += h;
      total += h;
    }
    return {
      userName: u.name,
      email: u.email,
      planned: Math.round(byCategory.PLANNED_TASK * 10) / 10,
      added: Math.round(byCategory.ADDED_TASK * 10) / 10,
      incident: Math.round(byCategory.INCIDENT * 10) / 10,
      support: Math.round(byCategory.SUPPORT * 10) / 10,
      admin: Math.round(byCategory.ADMIN * 10) / 10,
      learning: Math.round(byCategory.LEARNING * 10) / 10,
      total: Math.round(total * 10) / 10,
      workdays,
      target: targetPerUser,
      utilizationPct: targetPerUser > 0 ? Math.round((total / targetPerUser) * 100) : 0,
    };
  });

  return success({ users, workdays, targetPerUser });
}
