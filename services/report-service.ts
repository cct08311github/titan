import { PrismaClient, Prisma } from "@prisma/client";
import { calculateAchievement, calculateAvgAchievement } from "@/lib/kpi-calculator";
import { formatLocalDate } from "@/lib/utils/date";

// ── Filter types ────────────────────────────────────────────────────────────

export interface DateRangeFilter {
  startDate: Date;
  endDate: Date;
}

export interface ReportFilter {
  dateRange?: DateRangeFilter;
  userId?: string;
  isManager: boolean;
}

// ── Response types ──────────────────────────────────────────────────────────

export interface WeeklyReportData {
  period: { start: Date; end: Date };
  completedTasks: unknown[];
  completedCount: number;
  totalHours: number;
  hoursByCategory: Record<string, number>;
  overdueTasks: unknown[];
  overdueCount: number;
  changes: unknown[];
  delayCount: number;
  scopeChangeCount: number;
}

export interface MonthlyReportData {
  period: { year: number; month: number; start: Date; end: Date };
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  totalHours: number;
  hoursByCategory: Record<string, number>;
  monthlyGoals: unknown[];
  changes: unknown[];
  delayCount: number;
  scopeChangeCount: number;
}

export interface KPIReportData {
  year: number;
  kpis: unknown[];
  avgAchievement: number;
  achievedCount: number;
  totalCount: number;
}

export interface WorkloadReportData {
  period: { start: Date; end: Date };
  totalHours: number;
  plannedHours: number;
  unplannedHours: number;
  plannedRate: number;
  unplannedRate: number;
  hoursByCategory: Record<string, number>;
  byPerson: Array<{
    userId: string;
    name: string;
    total: number;
    planned: number;
    unplanned: number;
  }>;
  unplannedTasks: unknown[];
  unplannedBySource: Record<string, number>;
}

// ── Pivot table types (Issue #832 — T-5) ────────────────────────────────────

export interface PivotRow {
  userId: string;
  userName: string;
  cells: Record<string, number>; // category → hours
  total: number;
  overtimeTotal: number;
}

export interface TimesheetPivotData {
  period: { start: Date; end: Date; label: string };
  rows: PivotRow[];
  categories: string[];
  categoryTotals: Record<string, number>;
  grandTotal: number;
  grandOvertimeTotal: number;
}

export interface DelayChangeReportData {
  period: { start: Date; end: Date };
  delayCount: number;
  scopeChangeCount: number;
  total: number;
  byDate: Array<{
    date: string;
    delayCount: number;
    scopeChangeCount: number;
    total: number;
  }>;
  changes: unknown[];
}

// ── Helper ──────────────────────────────────────────────────────────────────

function computeWeekBounds(refDate: Date): { weekStart: Date; weekEnd: Date } {
  const day = refDate.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(refDate);
  weekStart.setDate(refDate.getDate() + diffToMon);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

function sumHoursByCategory(
  entries: Array<{ hours: number; category: string }>
): Record<string, number> {
  return entries.reduce(
    (acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.hours;
      return acc;
    },
    {} as Record<string, number>
  );
}

// ── Service ─────────────────────────────────────────────────────────────────

export class ReportService {
  constructor(private readonly prisma: PrismaClient) {}

  // ── Weekly report ────────────────────────────────────────────────────────

  async getWeeklyReport(filter: ReportFilter & { refDate?: Date }): Promise<WeeklyReportData> {
    const refDate = filter.dateRange?.startDate ?? filter.refDate ?? new Date();
    const { weekStart, weekEnd } = computeWeekBounds(refDate);

    const userFilter = filter.isManager
      ? {}
      : { primaryAssigneeId: filter.userId };

    const completedTasks = await this.prisma.task.findMany({
      where: {
        ...userFilter,
        isSample: false,
        status: "DONE",
        updatedAt: { gte: weekStart, lte: weekEnd },
      },
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
      take: 1000,
    });

    const timeEntryFilter = filter.isManager
      ? { date: { gte: weekStart, lte: weekEnd } }
      : { userId: filter.userId, date: { gte: weekStart, lte: weekEnd } };

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: timeEntryFilter,
      select: {
        hours: true,
        category: true,
        userId: true,
        user: { select: { id: true, name: true } },
      },
      take: 1000,
    });

    const totalHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);
    const hoursByCategory = sumHoursByCategory(timeEntries);

    const overdueTasks = await this.prisma.task.findMany({
      where: {
        ...userFilter,
        isSample: false,
        status: { notIn: ["DONE"] },
        dueDate: { lt: new Date() },
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        primaryAssignee: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    });

    const changes = await this.prisma.taskChange.findMany({
      where: { changedAt: { gte: weekStart, lte: weekEnd } },
      include: {
        task: { select: { id: true, title: true } },
        changedByUser: { select: { id: true, name: true } },
      },
      orderBy: { changedAt: "desc" },
    });

    return {
      period: { start: weekStart, end: weekEnd },
      completedTasks,
      completedCount: completedTasks.length,
      totalHours,
      hoursByCategory,
      overdueTasks,
      overdueCount: overdueTasks.length,
      changes,
      delayCount: changes.filter((c) => c.changeType === "DELAY").length,
      scopeChangeCount: changes.filter((c) => c.changeType === "SCOPE_CHANGE").length,
    };
  }

  // ── Monthly report ───────────────────────────────────────────────────────

  async getMonthlyReport(
    filter: ReportFilter & { year?: number; month?: number }
  ): Promise<MonthlyReportData> {
    const now = new Date();
    const year = filter.year ?? now.getFullYear();
    const month = filter.month ?? now.getMonth() + 1;

    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const userFilter = filter.isManager
      ? {}
      : { primaryAssigneeId: filter.userId };

    const allTasks = await this.prisma.task.findMany({
      where: {
        ...userFilter,
        isSample: false,
        createdAt: { lte: monthEnd },
        OR: [
          { dueDate: { gte: monthStart, lte: monthEnd } },
          { status: "DONE", updatedAt: { gte: monthStart, lte: monthEnd } },
          { status: { notIn: ["DONE"] }, dueDate: null },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        category: true,
        dueDate: true,
        updatedAt: true,
        progressPct: true,
        primaryAssignee: { select: { id: true, name: true } },
        monthlyGoal: { select: { id: true, title: true, month: true } },
      },
      take: 1000,
    });

    const completedTasks = allTasks.filter((t) => t.status === "DONE");
    const completionRate =
      allTasks.length > 0
        ? Math.round((completedTasks.length / allTasks.length) * 100)
        : 0;

    const timeEntryFilter = filter.isManager
      ? { date: { gte: monthStart, lte: monthEnd } }
      : { userId: filter.userId, date: { gte: monthStart, lte: monthEnd } };

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: timeEntryFilter,
      select: {
        hours: true,
        category: true,
        userId: true,
        user: { select: { id: true, name: true } },
      },
      take: 1000,
    });

    const totalHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);
    const hoursByCategory = sumHoursByCategory(timeEntries);

    const monthlyGoals = await this.prisma.monthlyGoal.findMany({
      where: { month, annualPlan: { year } },
      include: {
        tasks: {
          where: userFilter,
          select: { id: true, status: true, progressPct: true },
        },
      },
    });

    const changes = await this.prisma.taskChange.findMany({
      where: { changedAt: { gte: monthStart, lte: monthEnd } },
      include: {
        task: { select: { id: true, title: true } },
        changedByUser: { select: { id: true, name: true } },
      },
    });

    return {
      period: { year, month, start: monthStart, end: monthEnd },
      totalTasks: allTasks.length,
      completedTasks: completedTasks.length,
      completionRate,
      totalHours,
      hoursByCategory,
      monthlyGoals,
      changes,
      delayCount: changes.filter((c) => c.changeType === "DELAY").length,
      scopeChangeCount: changes.filter((c) => c.changeType === "SCOPE_CHANGE").length,
    };
  }

  // ── KPI report ───────────────────────────────────────────────────────────

  async getKPIReport(year?: number): Promise<KPIReportData> {
    const targetYear = year ?? new Date().getFullYear();

    const kpis = await this.prisma.kPI.findMany({
      where: { year: targetYear },
      include: {
        taskLinks: {
          include: {
            task: {
              select: { id: true, title: true, status: true, progressPct: true },
            },
          },
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

    return {
      year: targetYear,
      kpis: kpisWithAchievement,
      avgAchievement: Math.round(avgAchievement * 10) / 10,
      achievedCount: kpisWithAchievement.filter(
        (k) => k.achievementRate >= 100
      ).length,
      totalCount: kpisWithAchievement.length,
    };
  }

  // ── Workload report ──────────────────────────────────────────────────────

  async getWorkloadReport(filter: ReportFilter): Promise<WorkloadReportData> {
    const now = new Date();
    const startDate =
      filter.dateRange?.startDate ??
      new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate =
      filter.dateRange?.endDate ??
      new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const timeEntryFilter = filter.isManager
      ? { date: { gte: startDate, lte: endDate } }
      : { userId: filter.userId, date: { gte: startDate, lte: endDate } };

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: timeEntryFilter,
      select: {
        hours: true,
        category: true,
        userId: true,
        user: { select: { id: true, name: true } },
        task: { select: { id: true, title: true, category: true } },
      },
      take: 1000,
    });

    const totalHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);
    const plannedHours = timeEntries
      .filter((e) => e.category === "PLANNED_TASK")
      .reduce((sum, e) => sum + e.hours, 0);
    const unplannedHours = timeEntries
      .filter((e) =>
        ["ADDED_TASK", "INCIDENT", "SUPPORT"].includes(e.category)
      )
      .reduce((sum, e) => sum + e.hours, 0);

    const hoursByCategory = sumHoursByCategory(timeEntries);

    const byPerson = timeEntries.reduce(
      (acc, e) => {
        const key = e.userId;
        if (!acc[key]) {
          acc[key] = {
            userId: e.userId,
            name: e.user.name,
            total: 0,
            planned: 0,
            unplanned: 0,
          };
        }
        acc[key].total += e.hours;
        if (e.category === "PLANNED_TASK") acc[key].planned += e.hours;
        if (["ADDED_TASK", "INCIDENT", "SUPPORT"].includes(e.category))
          acc[key].unplanned += e.hours;
        return acc;
      },
      {} as Record<
        string,
        {
          userId: string;
          name: string;
          total: number;
          planned: number;
          unplanned: number;
        }
      >
    );

    const unplannedTasks = await this.prisma.task.findMany({
      where: {
        ...(filter.isManager
          ? {}
          : { primaryAssigneeId: filter.userId }),
        isSample: false,
        category: { in: ["ADDED", "INCIDENT", "SUPPORT"] },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        title: true,
        status: true,
        category: true,
        addedSource: true,
        createdAt: true,
        primaryAssignee: { select: { id: true, name: true } },
      },
      take: 1000,
    });

    const unplannedBySource = unplannedTasks.reduce(
      (acc, t) => {
        const src = t.addedSource ?? "未填寫";
        acc[src] = (acc[src] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      period: { start: startDate, end: endDate },
      totalHours,
      plannedHours,
      unplannedHours,
      plannedRate:
        totalHours > 0
          ? Math.round((plannedHours / totalHours) * 100 * 10) / 10
          : 0,
      unplannedRate:
        totalHours > 0
          ? Math.round((unplannedHours / totalHours) * 100 * 10) / 10
          : 0,
      hoursByCategory,
      byPerson: Object.values(byPerson),
      unplannedTasks,
      unplannedBySource,
    };
  }

  // ── Timesheet Pivot Table — weekly (Issue #832, T-5) ─────────────────────

  async getWeeklyPivot(filter: ReportFilter & { refDate?: Date }): Promise<TimesheetPivotData> {
    const refDate = filter.dateRange?.startDate ?? filter.refDate ?? new Date();
    const { weekStart, weekEnd } = computeWeekBounds(refDate);

    return this.buildPivot({
      start: weekStart,
      end: weekEnd,
      label: `${formatLocalDate(weekStart)} ~ ${formatLocalDate(weekEnd)}`,
      isManager: filter.isManager,
      userId: filter.userId,
    });
  }

  // ── Timesheet Pivot Table — monthly (Issue #832, T-5) ──────────────────

  async getMonthlyPivot(filter: ReportFilter & { year?: number; month?: number }): Promise<TimesheetPivotData> {
    const now = new Date();
    const year = filter.year ?? now.getFullYear();
    const month = filter.month ?? now.getMonth() + 1;
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    return this.buildPivot({
      start,
      end,
      label: `${year}-${String(month).padStart(2, "0")}`,
      isManager: filter.isManager,
      userId: filter.userId,
    });
  }

  /** Shared pivot builder for weekly/monthly (Issue #832) */
  private async buildPivot(opts: {
    start: Date; end: Date; label: string;
    isManager: boolean; userId?: string;
  }): Promise<TimesheetPivotData> {
    const timeEntryFilter = opts.isManager
      ? { date: { gte: opts.start, lte: opts.end } }
      : { userId: opts.userId, date: { gte: opts.start, lte: opts.end } };

    const entries = await this.prisma.timeEntry.findMany({
      where: timeEntryFilter,
      select: {
        hours: true,
        category: true,
        userId: true,
        overtimeType: true,
        user: { select: { id: true, name: true } },
      },
    });

    const categorySet = new Set<string>();
    const userMap = new Map<string, PivotRow>();

    for (const e of entries) {
      categorySet.add(e.category);

      if (!userMap.has(e.userId)) {
        userMap.set(e.userId, {
          userId: e.userId,
          userName: e.user.name,
          cells: {},
          total: 0,
          overtimeTotal: 0,
        });
      }

      const row = userMap.get(e.userId)!;
      row.cells[e.category] = (row.cells[e.category] ?? 0) + e.hours;
      row.total += e.hours;
      if (e.overtimeType !== "NONE") {
        row.overtimeTotal += e.hours;
      }
    }

    const categories = Array.from(categorySet).sort();
    const rows = Array.from(userMap.values()).sort((a, b) => a.userName.localeCompare(b.userName));

    const categoryTotals: Record<string, number> = {};
    for (const cat of categories) {
      categoryTotals[cat] = rows.reduce((sum, r) => sum + (r.cells[cat] ?? 0), 0);
    }

    const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
    const grandOvertimeTotal = rows.reduce((sum, r) => sum + r.overtimeTotal, 0);

    return {
      period: { start: opts.start, end: opts.end, label: opts.label },
      rows,
      categories,
      categoryTotals,
      grandTotal,
      grandOvertimeTotal,
    };
  }

  // ── Delay/change report ──────────────────────────────────────────────────

  async getDelayChangeReport(
    filter: ReportFilter
  ): Promise<DelayChangeReportData> {
    const now = new Date();
    const startDate =
      filter.dateRange?.startDate ??
      new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate =
      filter.dateRange?.endDate ??
      new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const changes = await this.prisma.taskChange.findMany({
      where: {
        changedAt: { gte: startDate, lte: endDate },
      },
      include: {
        task: { select: { id: true, title: true } },
        changedByUser: { select: { id: true, name: true } },
      },
      orderBy: { changedAt: "asc" },
    });

    const delayChanges = changes.filter((c) => c.changeType === "DELAY");
    const scopeChanges = changes.filter(
      (c) => c.changeType === "SCOPE_CHANGE"
    );

    const byDateMap = changes.reduce(
      (acc, c) => {
        const dateKey = formatLocalDate(c.changedAt);
        if (!acc[dateKey]) {
          acc[dateKey] = {
            date: dateKey,
            delayCount: 0,
            scopeChangeCount: 0,
            total: 0,
          };
        }
        if (c.changeType === "DELAY") acc[dateKey].delayCount += 1;
        if (c.changeType === "SCOPE_CHANGE")
          acc[dateKey].scopeChangeCount += 1;
        acc[dateKey].total += 1;
        return acc;
      },
      {} as Record<
        string,
        {
          date: string;
          delayCount: number;
          scopeChangeCount: number;
          total: number;
        }
      >
    );

    return {
      period: { start: startDate, end: endDate },
      delayCount: delayChanges.length,
      scopeChangeCount: scopeChanges.length,
      total: changes.length,
      byDate: Object.values(byDateMap).sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
      changes,
    };
  }
}
