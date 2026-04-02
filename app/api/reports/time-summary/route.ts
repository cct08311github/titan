/**
 * GET /api/reports/time-summary — Issue #1161
 * Aggregate time entries by user and category for a date range.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch { return error("UnauthorizedError", "未授權", 401); }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const dateFilter: Record<string, unknown> = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const entries = await prisma.timeEntry.groupBy({
    by: ["userId", "category"],
    where: Object.keys(dateFilter).length ? { date: dateFilter } : {},
    _sum: { hours: true },
  });

  const userIds = [...new Set(entries.map((e) => e.userId))];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  return success(entries.map((e) => ({ userName: userMap[e.userId] ?? "未知", category: e.category, totalHours: e._sum.hours ?? 0 })));
}
