import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { ExportService } from "@/services/export-service";
import { formatLocalDate } from "@/lib/utils/date";
import { calculateAchievement, calculateAvgAchievement } from "@/lib/kpi-calculator";
import { parseYear } from "@/lib/query-params";

const exportService = new ExportService();

export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const { searchParams } = new URL(req.url);

  const type = searchParams.get("type") ?? "weekly";   // weekly | monthly | kpi | workload
  const format = searchParams.get("format") ?? "xlsx"; // xlsx | pdf | csv

  const isManager = session.user.role === "MANAGER";

  let result;

  // ── weekly ───────────────────────────────────────────────────────────────
  if (type === "weekly") {
    const dateParam = searchParams.get("date");
    const refDate = dateParam ? new Date(dateParam) : new Date();
    const day = refDate.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(refDate);
    weekStart.setDate(refDate.getDate() + diffToMon);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const userFilter = isManager ? {} : { primaryAssigneeId: session.user.id };

    const completedTasks = await prisma.task.findMany({
      where: { ...userFilter, status: "DONE", updatedAt: { gte: weekStart, lte: weekEnd } },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        category: true,
        updatedAt: true,
        primaryAssignee: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const timeEntryFilter = isManager
      ? { date: { gte: weekStart, lte: weekEnd } }
      : { userId: session.user.id, date: { gte: weekStart, lte: weekEnd } };

    const timeEntries = await prisma.timeEntry.findMany({
      where: timeEntryFilter,
      select: { hours: true, category: true },
    });
    const totalHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);
    const hoursByCategory = timeEntries.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.hours;
      return acc;
    }, {} as Record<string, number>);

    result = exportService.exportWeeklyReport({
      weekStart: formatLocalDate(weekStart),
      weekEnd: formatLocalDate(weekEnd),
      completedTasks,
      totalHours,
      hoursByCategory,
    });

  // ── monthly ──────────────────────────────────────────────────────────────
  } else if (type === "monthly") {
    const monthParam = searchParams.get("month");
    const now = new Date();
    const year = monthParam ? parseInt(monthParam.split("-")[0]) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam.split("-")[1]) : now.getMonth() + 1;

    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
    const userFilter = isManager ? {} : { primaryAssigneeId: session.user.id };

    const tasks = await prisma.task.findMany({
      where: {
        ...userFilter,
        createdAt: { lte: monthEnd },
        OR: [
          { dueDate: { gte: monthStart, lte: monthEnd } },
          { status: "DONE", updatedAt: { gte: monthStart, lte: monthEnd } },
          { status: { notIn: ["DONE"] }, dueDate: null },
        ],
      },
      select: { id: true, title: true, status: true, priority: true, dueDate: true },
      orderBy: { updatedAt: "desc" },
    });

    const doneTasks = tasks.filter((t) => t.status === "DONE").length;
    const completionRate = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;

    result = exportService.exportMonthlyReport({
      year,
      month,
      totalTasks: tasks.length,
      doneTasks,
      completionRate,
      tasks,
    });

  // ── kpi ───────────────────────────────────────────────────────────────────
  } else if (type === "kpi") {
    const year = parseYear(searchParams.get("year"));

    const kpis = await prisma.kPI.findMany({
      where: { year },
      include: {
        taskLinks: {
          include: { task: { select: { id: true, status: true, progressPct: true } } },
        },
      },
      orderBy: { code: "asc" },
    });

    const kpisWithAchievement = kpis.map((kpi) => ({
      ...kpi,
      achievementRate: calculateAchievement(kpi),
    }));

    const avgAchievement = calculateAvgAchievement(
      kpisWithAchievement.map((k) => k.achievementRate)
    );

    result = exportService.exportKPIReport({
      year,
      avgAchievement: Math.round(avgAchievement * 10) / 10,
      achievedCount: kpisWithAchievement.filter((k) => k.achievementRate >= 100).length,
      totalCount: kpisWithAchievement.length,
      kpis: kpisWithAchievement.map((k) => ({
        id: k.id,
        code: k.code,
        title: k.title,
        target: k.target,
        actual: k.actual,
        achievementRate: k.achievementRate,
      })),
    });

  // ── workload ──────────────────────────────────────────────────────────────
  } else {
    const now = new Date();
    const startParam = searchParams.get("startDate");
    const endParam = searchParams.get("endDate");
    const startDate = startParam
      ? new Date(startParam)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = endParam
      ? new Date(endParam)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const timeEntryFilter = isManager
      ? { date: { gte: startDate, lte: endDate } }
      : { userId: session.user.id, date: { gte: startDate, lte: endDate } };

    const timeEntries = await prisma.timeEntry.findMany({
      where: timeEntryFilter,
      include: { user: { select: { id: true, name: true } } },
    });

    const totalHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);
    const plannedHours = timeEntries
      .filter((e) => e.category === "PLANNED_TASK")
      .reduce((sum, e) => sum + e.hours, 0);
    const unplannedHours = timeEntries
      .filter((e) => ["ADDED_TASK", "INCIDENT", "SUPPORT"].includes(e.category))
      .reduce((sum, e) => sum + e.hours, 0);

    const byPersonMap = timeEntries.reduce((acc, e) => {
      if (!acc[e.userId]) {
        acc[e.userId] = { userId: e.userId, name: e.user.name, total: 0, planned: 0, unplanned: 0 };
      }
      acc[e.userId].total += e.hours;
      if (e.category === "PLANNED_TASK") acc[e.userId].planned += e.hours;
      if (["ADDED_TASK", "INCIDENT", "SUPPORT"].includes(e.category))
        acc[e.userId].unplanned += e.hours;
      return acc;
    }, {} as Record<string, { userId: string; name: string; total: number; planned: number; unplanned: number }>);

    result = exportService.exportWorkloadReport({
      startDate: formatLocalDate(startDate),
      endDate: formatLocalDate(endDate),
      totalHours,
      plannedHours,
      unplannedHours,
      byPerson: Object.values(byPersonMap),
    });
  }

  // ── Render format ──────────────────────────────────────────────────────────
  if (format === "csv") {
    const csvString = generateCsv(
      result.rows as Record<string, unknown>[],
      result.columns,
    );
    // Prepend UTF-8 BOM so Excel correctly recognises CJK characters
    const csvWithBom = "\uFEFF" + csvString;
    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${type}-report.csv"`,
      },
    });
  }

  if (format === "pdf") {
    const html = exportService.generatePDF(
      result.rows as Record<string, unknown>[],
      result.title,
    );
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${type}-report.html"`,
      },
    });
  }

  // Default: xlsx
  const buffer = await exportService.generateExcel(
    result.rows as Record<string, unknown>[],
    result.columns,
  );
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${type}-report.xlsx"`,
    },
  });
});

// ── CSV helper ──────────────────────────────────────────────────────────────

interface CsvColumn {
  header: string;
  key: string;
}

/**
 * Generate a RFC 4180 CSV string from rows and column definitions.
 * Handles quoting for values containing commas, quotes, or newlines.
 */
function generateCsv(rows: Record<string, unknown>[], columns: CsvColumn[]): string {
  const escapeCsvField = (value: unknown): string => {
    const str = value == null ? "" : String(value);
    // Quote fields that contain comma, double-quote, or newline
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = columns.map((c) => escapeCsvField(c.header)).join(",");
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCsvField(row[c.key])).join(",")
  );

  return [headerLine, ...dataLines].join("\r\n");
}
