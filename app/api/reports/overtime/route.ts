/**
 * GET /api/reports/overtime — Issue #1161
 * Overtime analysis: normal / overtime / holiday hours by user.
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

  const entries = await prisma.timeEntry.findMany({
    where: Object.keys(dateFilter).length ? { date: dateFilter } : {},
    select: { userId: true, hours: true, overtimeType: true, user: { select: { name: true } } },
  });

  const byUser = new Map<string, { userName: string; normal: number; overtime: number; holiday: number }>();
  for (const e of entries) {
    const existing = byUser.get(e.userId) ?? { userName: e.user.name, normal: 0, overtime: 0, holiday: 0 };
    const ot = (e.overtimeType ?? "NORMAL") as string;
    if (ot === "WEEKDAY_OT") existing.overtime += Number(e.hours);
    else if (ot === "HOLIDAY_OT") existing.holiday += Number(e.hours);
    else existing.normal += Number(e.hours);
    byUser.set(e.userId, existing);
  }

  return success([...byUser.values()]);
}
