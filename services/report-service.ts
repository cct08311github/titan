import { PrismaClient } from "@prisma/client";

export interface ReportDateRange { start: Date; end: Date; }
export interface ReportFilters {
  dateRange?: ReportDateRange;
  userId?: string;
  category?: string;
  isManager?: boolean;
}

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
  return { start: new Date(year, month - 1, 1, 0, 0, 0, 0), end: new Date(year, month, 0, 23, 59, 59, 999) };
}

function buildUserFilter(f: ReportFilters) {
  return f.userId && !f.isManager ? { primaryAssigneeId: f.userId } : {};
}

function buildTimeEntryFilter(f: ReportFilters, dr: ReportDateRange) {
  return f.userId && !f.isManager
    ? { userId: f.userId, date: { gte: dr.start, lte: dr.end } }
    : { date: { gte: dr.start, lte: dr.end } };
}

function aggregateHours(entries: Array<{ hours: number; category: string }>) {
  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const hoursByCategory = entries.reduce((a, e) => { a[e.category] = (a[e.category] ?? 0) + e.hours; return a; }, {} as Record<string, number>);
  return { totalHours, hoursByCategory };
}

export class ReportService {
  constructor(private readonly prisma: PrismaClient) {}

  async getWeeklyReport(filters: ReportFilters) {
    const refDate = filters.dateRange?.start ?? new Date();
    const { start: weekStart, end: weekEnd } = getWeekBounds(refDate);
    const uf = buildUserFilter(filters);
    const tef = buildTimeEntryFilter(filters, { start: weekStart, end: weekEnd });

    const completedTasks = await this.prisma.task.findMany({
      where: { ...uf, status: "DONE", updatedAt: { gte: weekStart, lte: weekEnd } },
      include: { primaryAssignee: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    });
    const timeEntries = await this.prisma.timeEntry.findMany({ where: tef, include: { user: { select: { id: true, name: true } } } });
    const { totalHours, hoursByCategory } = aggregateHours(timeEntries);
    const overdueTasks = await this.prisma.task.findMany({
      where: { ...uf, status: { notIn: ["DONE"] }, dueDate: { lt: new Date() } },
      include: { primaryAssignee: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" }, take: 10,
    });
    const changes = await this.prisma.taskChange.findMany({
      where: { changedAt: { gte: weekStart, lte: weekEnd } },
      include: { task: { select: { id: true, title: true } }, changedByUser: { select: { id: true, name: true } } },
      orderBy: { changedAt: "desc" },
    });
    return {
      period: { start: weekStart, end: weekEnd }, completedTasks, completedCount: completedTasks.length,
      totalHours, hoursByCategory, overdueTasks, overdueCount: overdueTasks.length, changes,
      delayCount: changes.filter((c) => c.changeType === "DELAY").length,
      scopeChangeCount: changes.filter((c) => c.changeType === "SCOPE_CHANGE").length,
    };
  }

  async getMonthlyReport(filters: ReportFilters & { year?: number; month?: number }) {
    const now = new Date();
    const year = filters.year ?? now.getFullYear();
    const month = filters.month ?? now.getMonth() + 1;
    const { start: ms, end: me } = getMonthBounds(year, month);
    const uf = buildUserFilter(filters);
    const tef = buildTimeEntryFilter(filters, { start: ms, end: me });

    const allTasks = await this.prisma.task.findMany({
      where: { ...uf, createdAt: { lte: me }, OR: [
        { dueDate: { gte: ms, lte: me } },
        { status: "DONE", updatedAt: { gte: ms, lte: me } },
        { status: { notIn: ["DONE"] }, dueDate: null },
      ]},
      include: { primaryAssignee: { select: { id: true, name: true } }, monthlyGoal: { select: { id: true, title: true, month: true } } },
    });
    const done = allTasks.filter((t) => t.status === "DONE");
    const completionRate = allTasks.length > 0 ? Math.round((done.length / allTasks.length) * 100) : 0;
    const te = await this.prisma.timeEntry.findMany({ where: tef, include: { user: { select: { id: true, name: true } } } });
    const { totalHours, hoursByCategory } = aggregateHours(te);
    const monthlyGoals = await this.prisma.monthlyGoal.findMany({
      where: { month, annualPlan: { year } },
      include: { tasks: { where: uf, select: { id: true, status: true, progressPct: true } } },
    });
    const changes = await this.prisma.taskChange.findMany({
      where: { changedAt: { gte: ms, lte: me } },
      include: { task: { select: { id: true, title: true } }, changedByUser: { select: { id: true, name: true } } },
    });
    return {
      period: { year, month, start: ms, end: me }, totalTasks: allTasks.length,
      completedTasks: done.length, completionRate, totalHours, hoursByCategory, monthlyGoals, changes,
      delayCount: changes.filter((c) => c.changeType === "DELAY").length,
      scopeChangeCount: changes.filter((c) => c.changeType === "SCOPE_CHANGE").length,
    };
  }

  async getWorkloadReport(filters: ReportFilters) {
    const now = new Date();
    const sd = filters.dateRange?.start ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const ed = filters.dateRange?.end ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const tef = buildTimeEntryFilter(filters, { start: sd, end: ed });

    const te = await this.prisma.timeEntry.findMany({
      where: tef,
      include: { user: { select: { id: true, name: true } }, task: { select: { id: true, title: true, category: true } } },
    });
    const totalHours = te.reduce((s, e) => s + e.hours, 0);
    const plannedHours = te.filter((e) => e.category === "PLANNED_TASK").reduce((s, e) => s + e.hours, 0);
    const unplannedHours = te.filter((e) => ["ADDED_TASK", "INCIDENT", "SUPPORT"].includes(e.category)).reduce((s, e) => s + e.hours, 0);
    const hoursByCategory = te.reduce((a, e) => { a[e.category] = (a[e.category] ?? 0) + e.hours; return a; }, {} as Record<string, number>);
    const byPerson = te.reduce((a, e) => {
      if (!a[e.userId]) a[e.userId] = { userId: e.userId, name: e.user.name, total: 0, planned: 0, unplanned: 0 };
      a[e.userId].total += e.hours;
      if (e.category === "PLANNED_TASK") a[e.userId].planned += e.hours;
      if (["ADDED_TASK", "INCIDENT", "SUPPORT"].includes(e.category)) a[e.userId].unplanned += e.hours;
      return a;
    }, {} as Record<string, { userId: string; name: string; total: number; planned: number; unplanned: number }>);
    const tuf = filters.userId && !filters.isManager ? { primaryAssigneeId: filters.userId } : {};
    const unplannedTasks = await this.prisma.task.findMany({
      where: { ...tuf, category: { in: ["ADDED", "INCIDENT", "SUPPORT"] }, createdAt: { gte: sd, lte: ed } },
      include: { primaryAssignee: { select: { id: true, name: true } } },
    });
    const unplannedBySource = unplannedTasks.reduce((a, t) => { const s = t.addedSource ?? "\u672a\u586b\u5beb"; a[s] = (a[s] ?? 0) + 1; return a; }, {} as Record<string, number>);
    return {
      period: { start: sd, end: ed }, totalHours, plannedHours, unplannedHours,
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
    const mapped = kpis.map((kpi) => {
      let r = 0;
      if (kpi.autoCalc && kpi.taskLinks.length > 0) {
        const tw = kpi.taskLinks.reduce((s, l) => s + l.weight, 0);
        const w = kpi.taskLinks.reduce((s, l) => s + ((l.task.status === "DONE" ? 100 : l.task.progressPct) * l.weight) / 100, 0);
        r = tw > 0 ? (w / tw) * kpi.target : 0;
      } else { r = kpi.target > 0 ? (kpi.actual / kpi.target) * 100 : 0; }
      return { ...kpi, achievementRate: Math.min(r, 100) };
    });
    const avg = mapped.length > 0 ? mapped.reduce((s, k) => s + k.achievementRate, 0) / mapped.length : 0;
    return { year, kpis: mapped, avgAchievement: Math.round(avg * 10) / 10,
      achievedCount: mapped.filter((k) => k.achievementRate >= 100).length, totalCount: mapped.length };
  }
}
