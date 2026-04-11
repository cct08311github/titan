/**
 * Report V2 Service — Issue #984
 *
 * 15 advanced report endpoints for management analytics.
 * Separated from existing ReportService to avoid bloating.
 */
import { PrismaClient } from "@prisma/client";

// ── Shared helpers ──────────────────────────────────────────────────────

function defaultDateRange(startDate?: string, endDate?: string) {
  const now = new Date();
  const start = startDate
    ? new Date(startDate + "T00:00:00")
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate
    ? new Date(endDate + "T23:59:59.999")
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Service ─────────────────────────────────────────────────────────────

export class ReportV2Service {
  constructor(private readonly prisma: PrismaClient) {}

  // 1. Utilization ──────────────────────────────────────────────────────
  async getUtilization(startDate?: string, endDate?: string) {
    const { start, end } = defaultDateRange(startDate, endDate);
    const AVAILABLE_HOURS_PER_WEEK = 40;

    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: { date: { gte: start, lte: end }, isDeleted: false },
      select: { userId: true, hours: true },
    });

    const weeks = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)));
    const hoursByUser: Record<string, number> = {};
    for (const e of timeEntries) {
      hoursByUser[e.userId] = (hoursByUser[e.userId] ?? 0) + Number(e.hours);
    }

    const userResults = users.map((u) => {
      const totalHours = hoursByUser[u.id] ?? 0;
      const availableHours = AVAILABLE_HOURS_PER_WEEK * weeks;
      return {
        userId: u.id,
        name: u.name,
        totalHours: round2(totalHours),
        availableHours,
        utilizationRate: round2(availableHours > 0 ? (totalHours / availableHours) * 100 : 0),
      };
    });

    const avgUtilization = userResults.length > 0
      ? round2(userResults.reduce((s, u) => s + u.utilizationRate, 0) / userResults.length)
      : 0;

    return { users: userResults, avgUtilization, period: { start, end } };
  }

  // 2. Unplanned Trend ─────────────────────────────────────────────────
  async getUnplannedTrend(startDate?: string, endDate?: string) {
    const { start, end } = defaultDateRange(startDate, endDate);

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: { date: { gte: start, lte: end }, isDeleted: false },
      select: { date: true, hours: true, category: true },
    });

    const monthMap: Record<string, { total: number; unplanned: number }> = {};
    const UNPLANNED_CATEGORIES = ["ADDED_TASK", "INCIDENT", "SUPPORT"];

    for (const e of timeEntries) {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap[key]) monthMap[key] = { total: 0, unplanned: 0 };
      monthMap[key].total += Number(e.hours);
      if (UNPLANNED_CATEGORIES.includes(e.category)) {
        monthMap[key].unplanned += Number(e.hours);
      }
    }

    const months = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        totalHours: round2(data.total),
        unplannedHours: round2(data.unplanned),
        unplannedRate: round2(data.total > 0 ? (data.unplanned / data.total) * 100 : 0),
      }));

    const avgUnplannedRate = months.length > 0
      ? round2(months.reduce((s, m) => s + m.unplannedRate, 0) / months.length)
      : 0;

    return { months, avgUnplannedRate, period: { start, end } };
  }

  // 3. Workload Distribution ───────────────────────────────────────────
  async getWorkloadDistribution(startDate?: string, endDate?: string) {
    const { start, end } = defaultDateRange(startDate, endDate);

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: { date: { gte: start, lte: end }, isDeleted: false },
      select: {
        userId: true,
        hours: true,
        category: true,
        user: { select: { id: true, name: true } },
      },
    });

    const userMap: Record<string, { userId: string; name: string; byCategory: Record<string, number>; total: number }> = {};
    for (const e of timeEntries) {
      if (!userMap[e.userId]) {
        userMap[e.userId] = { userId: e.userId, name: e.user.name, byCategory: {}, total: 0 };
      }
      userMap[e.userId].byCategory[e.category] = (userMap[e.userId].byCategory[e.category] ?? 0) + Number(e.hours);
      userMap[e.userId].total += Number(e.hours);
    }

    return {
      users: Object.values(userMap).map((u) => ({
        ...u,
        total: round2(u.total),
      })),
      period: { start, end },
    };
  }

  // 4. Velocity ────────────────────────────────────────────────────────
  async getVelocity(startDate?: string, endDate?: string) {
    const { start, end } = defaultDateRange(startDate, endDate);

    const tasks = await this.prisma.task.findMany({
      where: {
        isSample: false,
        OR: [
          { status: "DONE", updatedAt: { gte: start, lte: end } },
          { createdAt: { gte: start, lte: end } },
        ],
      },
      select: { id: true, status: true, createdAt: true, updatedAt: true },
    });

    const weekMap: Record<string, { completed: number; created: number }> = {};

    for (const t of tasks) {
      if (t.createdAt >= start && t.createdAt <= end) {
        const ws = getWeekStart(t.createdAt).toISOString().slice(0, 10);
        if (!weekMap[ws]) weekMap[ws] = { completed: 0, created: 0 };
        weekMap[ws].created++;
      }
      if (t.status === "DONE" && t.updatedAt >= start && t.updatedAt <= end) {
        const ws = getWeekStart(t.updatedAt).toISOString().slice(0, 10);
        if (!weekMap[ws]) weekMap[ws] = { completed: 0, created: 0 };
        weekMap[ws].completed++;
      }
    }

    const weeks = Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, data]) => ({
        weekStart,
        completed: data.completed,
        created: data.created,
        netChange: data.completed - data.created,
      }));

    const avgVelocity = weeks.length > 0
      ? round2(weeks.reduce((s, w) => s + w.completed, 0) / weeks.length)
      : 0;

    return { weeks, avgVelocity, period: { start, end } };
  }

  // 5. Time Efficiency ─────────────────────────────────────────────────
  async getTimeEfficiency(startDate?: string, endDate?: string) {
    const { start, end } = defaultDateRange(startDate, endDate);

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: { date: { gte: start, lte: end }, isDeleted: false },
      select: { userId: true, hours: true, user: { select: { id: true, name: true } } },
    });

    const completedTasks = await this.prisma.task.findMany({
      where: { isSample: false, status: "DONE", updatedAt: { gte: start, lte: end } },
      select: { id: true, primaryAssigneeId: true },
    });

    const hoursByUser: Record<string, { name: string; hours: number }> = {};
    for (const e of timeEntries) {
      if (!hoursByUser[e.userId]) hoursByUser[e.userId] = { name: e.user.name, hours: 0 };
      hoursByUser[e.userId].hours += Number(e.hours);
    }

    const tasksByUser: Record<string, number> = {};
    for (const t of completedTasks) {
      if (t.primaryAssigneeId) {
        tasksByUser[t.primaryAssigneeId] = (tasksByUser[t.primaryAssigneeId] ?? 0) + 1;
      }
    }

    const allUserIds = new Set([...Object.keys(hoursByUser), ...Object.keys(tasksByUser)]);
    const users = Array.from(allUserIds).map((userId) => {
      const totalHours = hoursByUser[userId]?.hours ?? 0;
      const completed = tasksByUser[userId] ?? 0;
      return {
        userId,
        name: hoursByUser[userId]?.name ?? "Unknown",
        totalHours: round2(totalHours),
        completedTasks: completed,
        hoursPerTask: completed > 0 ? round2(totalHours / completed) : 0,
      };
    });

    const totalCompleted = users.reduce((s, u) => s + u.completedTasks, 0);
    const totalHours = users.reduce((s, u) => s + u.totalHours, 0);
    const avgHoursPerTask = totalCompleted > 0 ? round2(totalHours / totalCompleted) : 0;

    return { users, avgHoursPerTask, period: { start, end } };
  }

  // 6. Earned Value ────────────────────────────────────────────────────
  async getEarnedValue(planId: string, asOfDate?: string) {
    const plan = await this.prisma.annualPlan.findUnique({
      where: { id: planId },
      include: {
        linkedTasks: {
          select: {
            id: true,
            status: true,
            estimatedHours: true,
            actualHours: true,
            progressPct: true,
            dueDate: true,
            createdAt: true,
          },
        },
      },
    });

    if (!plan) return null;

    const asOf = asOfDate ? new Date(asOfDate + "T23:59:59.999") : new Date();
    const totalEstimated = plan.linkedTasks.reduce((s, t) => s + Number(t.estimatedHours ?? 0), 0);

    // PV: planned value — estimated hours for tasks due before asOf
    const pv = plan.linkedTasks
      .filter((t) => t.dueDate && t.dueDate <= asOf)
      .reduce((s, t) => s + Number(t.estimatedHours ?? 0), 0);

    // EV: earned value — weighted by progress
    const ev = plan.linkedTasks.reduce((s, t) => s + Number(t.estimatedHours ?? 0) * (t.progressPct / 100), 0);

    // AC: actual cost (hours)
    const ac = plan.linkedTasks.reduce((s, t) => s + Number(t.actualHours), 0);

    const sv = ev - pv;
    const cv = ev - ac;
    const spi = pv > 0 ? round2(ev / pv) : 0;
    const cpi = ac > 0 ? round2(ev / ac) : 0;
    const eac = cpi > 0 ? round2(totalEstimated / cpi) : 0;

    return {
      planId: plan.id,
      title: plan.title,
      pv: round2(pv),
      ev: round2(ev),
      ac: round2(ac),
      sv: round2(sv),
      cv: round2(cv),
      spi,
      cpi,
      eac,
    };
  }

  // 7. Overdue Analysis ────────────────────────────────────────────────
  async getOverdueAnalysis(startDate?: string, endDate?: string) {
    const { start, end } = defaultDateRange(startDate, endDate);
    const now = new Date();

    const tasks = await this.prisma.task.findMany({
      where: {
        status: { not: "DONE" },
        dueDate: { lt: now, gte: start },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        category: true,
        primaryAssignee: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    const overdueItems = tasks.map((t) => {
      const daysOverdue = Math.ceil((now.getTime() - (t.dueDate?.getTime() ?? now.getTime())) / (1000 * 60 * 60 * 24));
      return {
        id: t.id,
        title: t.title,
        assignee: t.primaryAssignee ? { id: t.primaryAssignee.id, name: t.primaryAssignee.name } : null,
        dueDate: t.dueDate,
        daysOverdue,
        cause: t.category,
      };
    });

    const byPerson: Record<string, { name: string; count: number; totalDaysOverdue: number }> = {};
    for (const item of overdueItems) {
      const key = item.assignee?.id ?? "unassigned";
      if (!byPerson[key]) byPerson[key] = { name: item.assignee?.name ?? "未指派", count: 0, totalDaysOverdue: 0 };
      byPerson[key].count++;
      byPerson[key].totalDaysOverdue += item.daysOverdue;
    }

    return {
      tasks: overdueItems,
      byPerson: Object.entries(byPerson).map(([userId, data]) => ({ userId, ...data })),
      totalOverdue: overdueItems.length,
      period: { start, end },
    };
  }

  // 8. Milestone Achievement ───────────────────────────────────────────
  async getMilestoneAchievement(year?: number) {
    const targetYear = year ?? new Date().getFullYear();

    const milestones = await this.prisma.milestone.findMany({
      where: { annualPlan: { year: targetYear } },
      include: { annualPlan: { select: { title: true } } },
      orderBy: { plannedEnd: "asc" },
    });

    const results = milestones.map((m) => {
      const daysVariance = m.actualEnd && m.plannedEnd
        ? Math.ceil((m.actualEnd.getTime() - m.plannedEnd.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      return {
        id: m.id,
        title: m.title,
        planTitle: m.annualPlan.title,
        status: m.status,
        plannedEnd: m.plannedEnd,
        actualEnd: m.actualEnd,
        daysVariance,
      };
    });

    const completed = results.filter((m) => m.status === "COMPLETED");
    const achievementRate = results.length > 0 ? round2((completed.length / results.length) * 100) : 0;

    return { milestones: results, achievementRate, year: targetYear };
  }

  // 9. KPI Trend ───────────────────────────────────────────────────────
  async getKPITrend(year?: number, kpiId?: string) {
    const targetYear = year ?? new Date().getFullYear();

    const where: Record<string, unknown> = { year: targetYear };
    if (kpiId) where.id = kpiId;

    const kpis = await this.prisma.kPI.findMany({
      where,
      select: { id: true, title: true, target: true },
    });

    const histories = await this.prisma.kPIHistory.findMany({
      where: {
        kpiId: { in: kpis.map((k) => k.id) },
        period: { startsWith: String(targetYear) },
      },
      orderBy: { period: "asc" },
    });

    const historyByKpi: Record<string, Array<{ period: string; actual: number }>> = {};
    for (const h of histories) {
      if (!historyByKpi[h.kpiId]) historyByKpi[h.kpiId] = [];
      historyByKpi[h.kpiId].push({ period: h.period, actual: h.actual });
    }

    const results = kpis.map((kpi) => {
      const monthData = historyByKpi[kpi.id] ?? [];
      const months = monthData.map((m) => ({
        period: m.period,
        actual: m.actual,
        achievementRate: kpi.target > 0 ? round2((m.actual / kpi.target) * 100) : 0,
      }));

      // Simple forecast: average of last 3 months
      const lastThree = months.slice(-3);
      const forecast = lastThree.length > 0
        ? round2(lastThree.reduce((s, m) => s + m.actual, 0) / lastThree.length)
        : 0;

      return { kpiId: kpi.id, title: kpi.title, target: kpi.target, months, forecast };
    });

    return { kpis: results, year: targetYear };
  }

  // 10. KPI Correlation ────────────────────────────────────────────────
  async getKPICorrelation(year?: number) {
    const targetYear = year ?? new Date().getFullYear();

    const kpis = await this.prisma.kPI.findMany({
      where: { year: targetYear },
      select: {
        id: true,
        title: true,
        target: true,
        actual: true,
        taskLinks: { select: { taskId: true } },
      },
    });

    const taskIds = kpis.flatMap((k) => k.taskLinks.map((tl) => tl.taskId));
    const timeEntries = await this.prisma.timeEntry.findMany({
      where: { taskId: { in: taskIds }, isDeleted: false },
      select: { taskId: true, hours: true },
    });

    const hoursByTask: Record<string, number> = {};
    for (const e of timeEntries) {
      if (e.taskId) hoursByTask[e.taskId] = (hoursByTask[e.taskId] ?? 0) + Number(e.hours);
    }

    const results = kpis.map((kpi) => {
      const linkedTaskHours = kpi.taskLinks.reduce((s, tl) => s + (hoursByTask[tl.taskId] ?? 0), 0);
      const achievementRate = kpi.target > 0 ? round2((kpi.actual / kpi.target) * 100) : 0;
      // Simple correlation: hours invested vs achievement
      const correlation = linkedTaskHours > 0 && achievementRate > 0
        ? round2(achievementRate / linkedTaskHours)
        : 0;
      return {
        kpiId: kpi.id,
        title: kpi.title,
        linkedTaskHours: round2(linkedTaskHours),
        achievementRate,
        correlation,
      };
    });

    return { kpis: results, year: targetYear };
  }

  // 11. KPI Composite ──────────────────────────────────────────────────
  async getKPIComposite(year?: number) {
    const targetYear = year ?? new Date().getFullYear();

    const kpis = await this.prisma.kPI.findMany({
      where: { year: targetYear },
      select: { id: true, title: true, target: true, actual: true, weight: true },
    });

    const totalWeight = kpis.reduce((s, k) => s + k.weight, 0);
    const results = kpis.map((kpi) => {
      const achievement = kpi.target > 0 ? round2((kpi.actual / kpi.target) * 100) : 0;
      const normalizedWeight = totalWeight > 0 ? round2(kpi.weight / totalWeight) : 0;
      const weightedScore = round2(achievement * normalizedWeight);
      return {
        kpiId: kpi.id,
        title: kpi.title,
        weight: kpi.weight,
        achievement,
        weightedScore,
      };
    });

    const compositeScore = round2(results.reduce((s, r) => s + r.weightedScore, 0));

    return { year: targetYear, kpis: results, compositeScore };
  }

  // 12. Overtime Analysis ──────────────────────────────────────────────
  async getOvertimeAnalysis(startDate?: string, endDate?: string) {
    const { start, end } = defaultDateRange(startDate, endDate);

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: {
        date: { gte: start, lte: end },
        overtimeType: { not: "NONE" },
        isDeleted: false,
      },
      select: {
        userId: true,
        hours: true,
        overtimeType: true,
        date: true,
        user: { select: { id: true, name: true } },
      },
    });

    const userMap: Record<string, { name: string; byType: Record<string, number>; totalOvertimeHours: number }> = {};
    const monthMap: Record<string, { totalOvertimeHours: number; byType: Record<string, number> }> = {};

    for (const e of timeEntries) {
      // By user
      if (!userMap[e.userId]) {
        userMap[e.userId] = { name: e.user.name, byType: {}, totalOvertimeHours: 0 };
      }
      userMap[e.userId].byType[e.overtimeType] = (userMap[e.userId].byType[e.overtimeType] ?? 0) + Number(e.hours);
      userMap[e.userId].totalOvertimeHours += Number(e.hours);

      // By month
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap[key]) monthMap[key] = { totalOvertimeHours: 0, byType: {} };
      monthMap[key].totalOvertimeHours += Number(e.hours);
      monthMap[key].byType[e.overtimeType] = (monthMap[key].byType[e.overtimeType] ?? 0) + Number(e.hours);
    }

    return {
      users: Object.entries(userMap).map(([userId, data]) => ({
        userId,
        ...data,
        totalOvertimeHours: round2(data.totalOvertimeHours),
      })),
      byMonth: Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          month,
          totalOvertimeHours: round2(data.totalOvertimeHours),
          byType: data.byType,
        })),
      period: { start, end },
    };
  }

  // 13. Change Summary ─────────────────────────────────────────────────
  async getChangeSummary(startDate?: string, endDate?: string) {
    const { start, end } = defaultDateRange(startDate, endDate);

    const changes = await this.prisma.changeRecord.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: {
        task: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const c of changes) {
      byType[c.type] = (byType[c.type] ?? 0) + 1;
      byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    }

    return {
      changes: changes.map((c) => ({
        id: c.id,
        changeNumber: c.changeNumber,
        type: c.type,
        status: c.status,
        riskLevel: c.riskLevel,
        taskTitle: c.task.title,
        scheduledStart: c.scheduledStart,
        scheduledEnd: c.scheduledEnd,
        createdAt: c.createdAt,
      })),
      byType,
      byStatus,
      total: changes.length,
      period: { start, end },
    };
  }

  // 14. Incident SLA ───────────────────────────────────────────────────
  async getIncidentSLA(startDate?: string, endDate?: string) {
    const { start, end } = defaultDateRange(startDate, endDate);

    const incidents = await this.prisma.incidentRecord.findMany({
      where: { incidentStart: { gte: start, lte: end } },
      include: {
        task: { select: { id: true, title: true, slaDeadline: true, status: true } },
      },
      orderBy: { incidentStart: "desc" },
    });

    let slaMetCount = 0;
    let totalMttr = 0;
    let mttrCount = 0;

    const bySeverity: Record<string, { count: number; slaMet: number; avgMttr: number; totalMttr: number }> = {};

    const results = incidents.map((inc) => {
      const slaMet = inc.task.slaDeadline
        ? (inc.incidentEnd ?? new Date()) <= inc.task.slaDeadline
        : true;
      if (slaMet) slaMetCount++;

      if (inc.mttrMinutes != null) {
        totalMttr += inc.mttrMinutes;
        mttrCount++;
      }

      if (!bySeverity[inc.severity]) {
        bySeverity[inc.severity] = { count: 0, slaMet: 0, avgMttr: 0, totalMttr: 0 };
      }
      bySeverity[inc.severity].count++;
      if (slaMet) bySeverity[inc.severity].slaMet++;
      if (inc.mttrMinutes != null) bySeverity[inc.severity].totalMttr += inc.mttrMinutes;

      return {
        id: inc.id,
        taskTitle: inc.task.title,
        severity: inc.severity,
        incidentStart: inc.incidentStart,
        incidentEnd: inc.incidentEnd,
        mttrMinutes: inc.mttrMinutes,
        slaMet,
      };
    });

    // Calculate avg MTTR per severity
    for (const sev of Object.values(bySeverity)) {
      sev.avgMttr = sev.count > 0 ? round2(sev.totalMttr / sev.count) : 0;
    }

    return {
      incidents: results,
      slaMetRate: incidents.length > 0 ? round2((slaMetCount / incidents.length) * 100) : 100,
      avgMttr: mttrCount > 0 ? round2(totalMttr / mttrCount) : 0,
      bySeverity: Object.entries(bySeverity).map(([severity, data]) => ({
        severity,
        count: data.count,
        slaMetRate: data.count > 0 ? round2((data.slaMet / data.count) * 100) : 100,
        avgMttr: data.avgMttr,
      })),
      period: { start, end },
    };
  }

  // 15. Permission Audit ───────────────────────────────────────────────
  async getPermissionAudit(startDate?: string, endDate?: string) {
    const { start, end } = defaultDateRange(startDate, endDate);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        resourceType: { in: ["Permission", "permission", "permissions"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        action: true,
        resourceId: true,
        detail: true,
        createdAt: true,
        metadata: true,
      },
    });

    const byAction: Record<string, number> = {};
    for (const log of logs) {
      byAction[log.action] = (byAction[log.action] ?? 0) + 1;
    }

    return {
      logs,
      totalChanges: logs.length,
      byAction,
      period: { start, end },
    };
  }
}
