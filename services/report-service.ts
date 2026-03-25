import { PrismaClient } from "@prisma/client";

// ── Filter types ──────────────────────────────────────────────────────────────

export interface ReportDateRange {
  start: Date;
  end: Date;
}

export interface ReportFilters {
  dateRange?: ReportDateRange;
  userId?: string;
  category?: string;
  isManager?: boolean;
}

// ── Helper: week bounds (Monday–Sunday) ──────────────────────────────────────

function getWeekBounds(refDate: Date): ReportDateRange {
  const day = refDate.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(refDate);
  weekStart.setDate(refDate.getDate() + diffToMon);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { start: weekStart, end: weekEnd };
}

function getMonthBounds(year: number, month: number): ReportDateRange {
  const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  return { start: monthStart, end: monthEnd };
}

// ── Helper: user filter builder ──────────────────────────────────────────────

function buildUserFilter(filters: ReportFilters) {
  if (filters.userId && !filters.isManager) {
    return { primaryAssigneeId: filters.userId };
  }
  return {};
}

function buildTimeEntryFilter(filters: ReportFilters, dateRange: ReportDateRange) {
  if (filters.userId && !filters.isManager) {
    return { userId: filters.userId, date: { gte: dateRange.start, lte: dateRange.end } };
  }
  return { date: { gte: dateRange.start, lte: dateRange.end } };
}

// ── Helper: hours aggregation ────────────────────────────────────────────────

interface TimeEntryRow {
  hours: number;
  category: string;
  userId: string;
  user: { id: string; name: string };
}

function aggregateHours(entries: TimeEntryRow[]) {
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const hoursByCategory = entries.reduce(
    (acc, e) => { acc[e.category] = (acc[e.category] ?? 0) + e.hours; return acc; },
    {} as Record<string, number>,
  );
  return { totalHours, hoursByCategory };
}

// ── ReportService ────────────────────────────────────────────────────────────

export class ReportService {
  constructor(private readonly prisma: PrismaClient) {}

  async getWeeklyReport(filters: ReportFilters) {
    const refDate = filters.dateRange?.start ?? new Date();
    const { start: weekStart, end: weekEnd } = getWeekBounds(refDate);
    const userFilter = buildUserFilter(filters);
    const timeEntryFilter = buildTimeEntryFilter(filters, { start: weekStart, end: weekEnd });

    const completedTasks = await this.prisma.task.findMany({
      where: { ...userFilter, status: "DONE", updatedAt: { gte: weekStart, lte: weekEnd } },
      include: { primaryAssignee: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    });

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: timeEntryFilter,
      include: { user: { select: { id: true, name: true } } },
    });
    const { totalHours, hoursByCategory } = aggregateHours(timeEntries);

    const overdueTasks = await this.prisma.task.findMany({
      where: { ...userFilter, status: { notIn: ["DONE"] }, dueDate: { lt: new Date() } },
      include: { primaryAssignee: { select: { id: true, name: true } } },
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
      completedTasks, completedCount: completedTasks.length,
      totalHours, hoursByCategory,
      overdueTasks, overdueCount: overdueTasks.length,
      changes,
      delayCount: changes.filter((c) => c.changeType === "DELAY").length,
      scopeChangeCount: changes.filter((c) => c.changeType === "SCOPE_CHANGE").length,
    };
  }

  async getMonthlyReport(filters: ReportFilters & { year?: number; month?: number }) {
    const now = new Date();
    const year = filters.year ?? now.getFullYear();
    const month = filters.month ?? now.getMonth() + 1;
    const { start: monthStart, end: monthEnd } = getMonthBounds(year, month);
    const userFilter = buildUserFilter(filters);
    const timeEntryFilter = buildTimeEntryFilter(filters, { start: monthStart, end: monthEnd });

    const allTasks = await this.prisma.task.findMany({
      where: {
        ...userFilter, createdAt: { lte: monthEnd },
        OR: [
          { dueDate: { gte: monthStart, lte: monthEnd } },
          { status: "DONE", updatedAt: { gte: monthStart, lte: monthEnd } },
          { status: { notIn: ["DONE"] }, dueDate: null },
        ],
      },
      include: {
        primaryAssignee: { select: { id: true, name: true } },
        monthlyGoal: { select: { id: true, title: true, month: true } },
      },
    });

    const completedTasks = allTasks.filter((t) => t.status === "DONE");
    const completionRate = allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0;

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: timeEntryFilter,
      include: { user: { select: { id: true, name: true } } },
    });
    const { totalHours, hoursByCategory } = aggregateHours(timeEntries);

    const monthlyGoals = await this.prisma.monthlyGoal.findMany({
      where: { month, annualPlan: { year } },
      include: { tasks: { where: userFilter, select: { id: true, status: true, progressPct: true } } },
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
      totalTasks: allTasks.length, completedTasks: completedTasks.length, completionRate,
      totalHours, hoursByCategory, monthlyGoals, changes,
      delayCount: changes.filter((c) => c.changeType === "DELAY").length,
      scopeChangeCount: changes.filter((c) => c.changeType === "SCOPE_CHANGE").length,
    };
  }

  async getWorkloadReport(filters: ReportFilters) {
    const now = new Date();
    const startDate = filters.dateRange?.start ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = filters.dateRange?.end ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const timeEntryFilter = buildTimeEntryFilter(filters, { start: startDate, end: endDate });

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: timeEntryFilter,
      include: { user: { select: { id: true, name: true } }, task: { select: { id: true, title: true, category: true } } },
    });

    const totalHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);
    const plannedHours = timeEntries.filter((e) => e.category === "PLANNED_TASK").reduce((sum, e) => sum + e.hours, 0);
    const unplannedHours = timeEntries.filter((e) => ["ADDED_TASK", "INCIDENT", "SUPPORT"].includes(e.category)).reduce((sum, e) => sum + e.hours, 0);
    const hoursByCategory = timeEntries.reduce((acc, e) => { acc[e.category] = (acc[e.category] ?? 0) + e.hours; return acc; }, {} as Record<string, number>);

    const byPerson = timeEntries.reduce((acc, e) => {
      if (!acc[e.userId]) acc[e.userId] = { userId: e.userId, name: e.user.name, total: 0, planned: 0, unplanned: 0 };
      acc[e.userId].total += e.hours;
      if (e.category === "PLANNED_TASK") acc[e.userId].planned += e.hours;
      if (["ADDED_TASK", "INCIDENT", "SUPPORT"].includes(e.category)) acc[e.userId].unplanned += e.hours;
      return acc;
    }, {} as Record<string, { userId: string; name: string; total: number; planned: number; unplanned: number }>);

    const taskUserFilter = filters.userId && !filters.isManager ? { primaryAssigneeId: filters.userId } : {};
    const unplannedTasks = await this.prisma.task.findMany({
      where: { ...taskUserFilter, category: { in: ["ADDED", "INCIDENT", "SUPPORT"] }, createdAt: { gte: startDate, lte: endDate } },
      include: { primaryAssignee: { select: { id: true, name: true } } },
    });
    const unplannedBySource = unplannedTasks.reduce((acc, t) => { const src = t.addedSource ?? "\u672a\u586b\u5beb"; acc[src] = (acc[src] ?? 0) + 1; return acc; }, {} as Record<string, number>);

    return {
      period: { start: startDate, end: endDate },
      totalHours, plannedHours, unplannedHours,
      plannedRate: totalHours > 0 ? Math.round((plannedHours / totalHours) * 100 * 10) / 10 : 0,
      unplannedRate: totalHours > 0 ? Math.round((unplannedHours / totalHours) * 100 * 10) / 10 : 0,
      hoursByCategory, byPerson: Object.values(byPerson), unplannedTasks, unplannedBySource,
    };
  }

  async getKPIReport(filters: { year?: number } = {}) {
    const year = filters.year ?? new Date().getFullYear();
    const kpis = await this.prisma.kPI.findMany({
      where: { year },
      include: { taskLinks: { include: { task: { select: { id: true, title: true, status: true, progressPct: true } } } } },
      orderBy: { code: "asc" },
    });

    const kpisWithAchievement = kpis.map((kpi) => {
      let achievementRate = 0;
      if (kpi.autoCalc && kpi.taskLinks.length > 0) {
        const totalWeight = kpi.taskLinks.reduce((sum, l) => sum + l.weight, 0);
        const weighted = kpi.taskLinks.reduce((sum, l) => {
          const prog = l.task.status === "DONE" ? 100 : l.task.progressPct;
          return sum + (prog * l.weight) / 100;
        }, 0);
        achievementRate = totalWeight > 0 ? (weighted / totalWeight) * kpi.target : 0;
      } else {
        achievementRate = kpi.target > 0 ? (kpi.actual / kpi.target) * 100 : 0;
      }
      return { ...kpi, achievementRate: Math.min(achievementRate, 100) };
    });

    const avgAchievement = kpisWithAchievement.length > 0
      ? kpisWithAchievement.reduce((s, k) => s + k.achievementRate, 0) / kpisWithAchievement.length : 0;

    return {
      year, kpis: kpisWithAchievement,
      avgAchievement: Math.round(avgAchievement * 10) / 10,
      achievedCount: kpisWithAchievement.filter((k) => k.achievementRate >= 100).length,
      totalCount: kpisWithAchievement.length,
    };
  }
}
