import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { apiHandler } from "@/lib/api-handler";
import { success, error } from "@/lib/api-response";

/**
 * GET /api/reports/trends?metric=kpi|kpi-achievement|workload|delays&years=2025,2026
 *
 * Returns monthly aggregated data for cross-year comparison.
 *
 * Issue #422: Enhanced with:
 * - metric=kpi-achievement: per-KPI achievement trend with individual breakdown
 * - Year-over-year comparison table in response
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const session = await requireAuth();
  // requireAuth throws UnauthorizedError if no session — caught by apiHandler

  const { searchParams } = new URL(req.url);
  const metric = searchParams.get("metric") ?? "kpi";
  const yearsParam = searchParams.get("years") ?? String(new Date().getFullYear());
  const years = yearsParam.split(",").map(Number).filter((y) => y > 2000 && y < 2100);

  if (years.length === 0) {
    return error("ValidationError", "Invalid years parameter", 400);
  }

  const results: Record<number, Array<{ month: number; value: number }>> = {};

  // Per-KPI achievement breakdown (for kpi and kpi-achievement metrics)
  let kpiAchievement: Record<number, Array<{
    code: string;
    title: string;
    target: number;
    actual: number;
    achievementRate: number;
    status: string;
  }>> | undefined;

  // Year-over-year comparison table
  let yearOverYear: Array<{
    year: number;
    avgAchievementRate: number;
    totalKpis: number;
    achievedCount: number;
    missedCount: number;
    activeCount: number;
  }> | undefined;

  for (const year of years) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    if (metric === "kpi" || metric === "kpi-achievement") {
      // KPI achievement rate by month (average across all KPIs)
      const kpis = await prisma.kPI.findMany({
        where: { deletedAt: null, year },
        select: { code: true, title: true, target: true, actual: true, status: true, weight: true },
      });

      const avgRate = kpis.length > 0
        ? kpis.reduce((sum, k) => sum + (k.target > 0 ? (k.actual / k.target) * 100 : 0), 0) / kpis.length
        : 0;

      // Monthly trend: for KPI we return the annual average as a constant per month
      // (KPIs are annual targets, not monthly)
      results[year] = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        value: Math.round(avgRate * 10) / 10,
      }));

      // Per-KPI breakdown
      if (!kpiAchievement) kpiAchievement = {};
      kpiAchievement[year] = kpis.map((k) => ({
        code: k.code,
        title: k.title,
        target: k.target,
        actual: k.actual,
        achievementRate: k.target > 0 ? Math.round((k.actual / k.target) * 1000) / 10 : 0,
        status: k.status,
      }));

      // Year-over-year summary
      if (!yearOverYear) yearOverYear = [];
      yearOverYear.push({
        year,
        avgAchievementRate: Math.round(avgRate * 10) / 10,
        totalKpis: kpis.length,
        achievedCount: kpis.filter((k) => k.status === "ACHIEVED").length,
        missedCount: kpis.filter((k) => k.status === "MISSED").length,
        activeCount: kpis.filter((k) => k.status === "ACTIVE").length,
      });
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

      // Workload year-over-year
      if (!yearOverYear) yearOverYear = [];
      const totalHours = Object.values(byMonth).reduce((s, m) => s + m.total, 0);
      const totalUnplanned = Object.values(byMonth).reduce((s, m) => s + m.unplanned, 0);
      yearOverYear.push({
        year,
        avgAchievementRate: totalHours > 0 ? Math.round((totalUnplanned / totalHours) * 1000) / 10 : 0,
        totalKpis: 0,
        achievedCount: 0,
        missedCount: 0,
        activeCount: 0,
      });
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

      // Delays year-over-year
      if (!yearOverYear) yearOverYear = [];
      const totalDelays = Object.values(byMonth).reduce((s, v) => s + v, 0);
      yearOverYear.push({
        year,
        avgAchievementRate: 0,
        totalKpis: 0,
        achievedCount: 0,
        missedCount: totalDelays,
        activeCount: 0,
      });
    } else {
      return error("ValidationError", `Unknown metric: ${metric}`, 400);
    }
  }

  return success({
    metric,
    years,
    data: results,
    ...(kpiAchievement && { kpiAchievement }),
    ...(yearOverYear && { yearOverYear }),
  });
});
