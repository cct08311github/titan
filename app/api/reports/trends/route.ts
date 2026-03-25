import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

/**
 * GET /api/reports/trends?metric=kpi|workload|delays&years=2025,2026
 *
 * Returns monthly aggregated data for cross-year comparison.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth();
  // requireAuth throws UnauthorizedError if no session — caught by apiHandler

  const { searchParams } = new URL(req.url);
  const metric = searchParams.get("metric") ?? "kpi";
  const yearsParam = searchParams.get("years") ?? String(new Date().getFullYear());
  const years = yearsParam.split(",").map(Number).filter((y) => y > 2000 && y < 2100);

  if (years.length === 0) {
    return NextResponse.json({ error: "Invalid years parameter" }, { status: 400 });
  }

  const results: Record<number, Array<{ month: number; value: number }>> = {};

  for (const year of years) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    if (metric === "kpi") {
      // KPI achievement rate by month (average across all KPIs)
      const kpis = await prisma.kPI.findMany({
        where: { year },
        select: { target: true, actual: true },
      });
      const avgRate = kpis.length > 0
        ? kpis.reduce((sum, k) => sum + (k.target > 0 ? (k.actual / k.target) * 100 : 0), 0) / kpis.length
        : 0;
      // For KPI we return a single annual value per month placeholder
      results[year] = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        value: Math.round(avgRate * 10) / 10,
      }));
    } else if (metric === "workload") {
      // Monthly hours by category (planned vs unplanned ratio)
      const entries = await prisma.timeEntry.findMany({
        where: { date: { gte: startDate, lt: endDate } },
        select: { date: true, hours: true, task: { select: { category: true } } },
      });
      const byMonth: Record<number, { total: number; unplanned: number }> = {};
      for (let m = 1; m <= 12; m++) byMonth[m] = { total: 0, unplanned: 0 };
      for (const e of entries) {
        const m = new Date(e.date).getMonth() + 1;
        const h = Number(e.hours) || 0;
        byMonth[m].total += h;
        if (e.task?.category && ["ADDED", "INCIDENT", "SUPPORT"].includes(e.task.category)) {
          byMonth[m].unplanned += h;
        }
      }
      results[year] = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        value: byMonth[i + 1].total > 0
          ? Math.round((byMonth[i + 1].unplanned / byMonth[i + 1].total) * 1000) / 10
          : 0,
      }));
    } else if (metric === "delays") {
      // Monthly delay count
      const tasks = await prisma.task.findMany({
        where: {
          dueDate: { gte: startDate, lt: endDate },
          status: { not: "DONE" },
        },
        select: { dueDate: true },
      });
      const byMonth: Record<number, number> = {};
      for (let m = 1; m <= 12; m++) byMonth[m] = 0;
      const now = new Date();
      for (const t of tasks) {
        if (t.dueDate && new Date(t.dueDate) < now) {
          const m = new Date(t.dueDate).getMonth() + 1;
          byMonth[m]++;
        }
      }
      results[year] = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        value: byMonth[i + 1],
      }));
    } else {
      return NextResponse.json({ error: `Unknown metric: ${metric}` }, { status: 400 });
    }
  }

  return NextResponse.json({ metric, years, data: results });
}
