/**
 * GET /api/reports/overtime — Issue #1161 (HR Compliance Grade)
 *
 * Per-user overtime breakdown with legal limit warnings.
 * Taiwan labor law: max 46h overtime per month.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { success, error } from "@/lib/api-response";

const MONTHLY_OT_LIMIT = 46; // Taiwan Labor Standards Act

export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch { return error("UnauthorizedError", "未授權", 401); }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const toDate = to ? new Date(to) : new Date();

  const entries = await prisma.timeEntry.findMany({
    where: { date: { gte: fromDate, lte: toDate } },
    select: { userId: true, hours: true, overtimeType: true },
  });

  const allUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true },
  });

  const months = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / (30 * 24 * 60 * 60 * 1000)));

  const users = allUsers.map((u) => {
    const userEntries = entries.filter((e) => e.userId === u.id);
    let normal = 0, weekdayOT = 0, holidayOT = 0;
    for (const e of userEntries) {
      const h = Number(e.hours);
      const ot = (e.overtimeType ?? "NORMAL") as string;
      if (ot === "WEEKDAY_OT") weekdayOT += h;
      else if (ot === "HOLIDAY_OT") holidayOT += h;
      else normal += h;
    }
    const totalOT = weekdayOT + holidayOT;
    const totalHours = normal + totalOT;
    const monthlyOTAvg = Math.round(totalOT / months * 10) / 10;

    return {
      userName: u.name,
      email: u.email,
      normal: Math.round(normal * 10) / 10,
      weekdayOT: Math.round(weekdayOT * 10) / 10,
      holidayOT: Math.round(holidayOT * 10) / 10,
      totalOT: Math.round(totalOT * 10) / 10,
      totalHours: Math.round(totalHours * 10) / 10,
      otRatio: totalHours > 0 ? Math.round((totalOT / totalHours) * 100) : 0,
      monthlyOTLimit: MONTHLY_OT_LIMIT,
      overLimit: monthlyOTAvg > MONTHLY_OT_LIMIT,
    };
  });

  return success({ users, months, monthlyOTLimit: MONTHLY_OT_LIMIT });
}
