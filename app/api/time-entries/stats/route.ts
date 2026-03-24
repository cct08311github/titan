import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || session.user.id;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

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

    return NextResponse.json({
      totalHours,
      breakdown,
      taskInvestmentRate,
      entryCount: entries.length,
    });
  } catch (error) {
    console.error("GET /api/time-entries/stats error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
