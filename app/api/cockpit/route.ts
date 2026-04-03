/**
 * Cockpit Summary API — Issue #951, enhanced Issue #962
 *
 * GET /api/cockpit?year=2026
 * Returns aggregated management cockpit data: plan health, KPI summaries,
 * goal progress, task distribution, time investment, alerts, flaggedCount,
 * and rootCauseTasks for drill-down.
 * MANAGER / ADMIN only.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";
import { requireMinRole } from "@/lib/rbac";
import { parseYear } from "@/lib/query-params";

// ── Types ─────────────────────────────────────────────────────────────────

export type HealthStatus = "HEALTHY" | "AT_RISK" | "CRITICAL";

interface Alert {
  type: "CRITICAL" | "WARNING" | "INFO";
  category: "GOAL" | "KPI" | "TASK" | "MILESTONE";
  message: string;
  targetId: string;
  targetType: string;
}

// ── Health calculation — refined Issue #962 ──────────────────────────────
//
// CRITICAL: >30% overdue OR (KPI<50% AND time>75%)
// AT_RISK:  any overdue OR KPI<80%
// HEALTHY:  none of the above

export function calculateHealthStatus(
  _progressPct: number,
  timeElapsedPct: number,
  overdueCount: number,
  totalTasks: number,
  kpiAvgAchievement: number,
  _kpiBehindCount: number,
): HealthStatus {
  const overdueRate = totalTasks > 0 ? overdueCount / totalTasks : 0;

  // CRITICAL: >30% tasks overdue OR (KPI avg < 50% AND time elapsed > 75%)
  if (overdueRate > 0.3) return "CRITICAL";
  if (kpiAvgAchievement < 50 && timeElapsedPct > 75) return "CRITICAL";

  // AT_RISK: any overdue task OR KPI avg < 80%
  if (overdueCount > 0) return "AT_RISK";
  if (kpiAvgAchievement < 80) return "AT_RISK";

  return "HEALTHY";
}

// ── GET handler ───────────────────────────────────────────────────────────

export const GET = withManager(async (req: NextRequest) => {
  const session = await requireMinRole("MANAGER");
  const { searchParams } = new URL(req.url);
  const year = parseYear(searchParams.get("year"));

  // Fetch plan with goals, tasks, KPI links, time entries, milestones
  const plans = await prisma.annualPlan.findMany({
    where: { year, archivedAt: null },
    include: {
      monthlyGoals: {
        include: {
          tasks: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
              progressPct: true,
              estimatedHours: true,
              actualHours: true,
              managerFlagged: true,
              primaryAssignee: { select: { id: true, name: true } },
              kpiLinks: {
                include: {
                  kpi: {
                    select: {
                      id: true,
                      code: true,
                      title: true,
                      target: true,
                      actual: true,
                      status: true,
                      visibility: true,
                    },
                  },
                },
              },
              timeEntries: {
                select: { hours: true, category: true },
              },
            },
          },
        },
      },
      linkedTasks: {
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          progressPct: true,
          estimatedHours: true,
          actualHours: true,
          managerFlagged: true,
          primaryAssignee: { select: { id: true, name: true } },
          kpiLinks: {
            include: {
              kpi: {
                select: {
                  id: true,
                  code: true,
                  title: true,
                  target: true,
                  actual: true,
                  status: true,
                  visibility: true,
                },
              },
            },
          },
          timeEntries: {
            select: { hours: true, category: true },
          },
        },
      },
      milestones: {
        select: {
          id: true,
          title: true,
          type: true,
          plannedEnd: true,
          status: true,
        },
      },
    },
  });

  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const yearProgressPct = (currentMonth / 12) * 100;

  const result = plans.map((plan) => {
    // Collect ALL tasks under this plan (via goals + direct linked)
    const goalTasks = plan.monthlyGoals.flatMap((g) => g.tasks);
    const allTasks = [...goalTasks, ...plan.linkedTasks];

    // Deduplicate tasks by id
    const taskMap = new Map<string, (typeof allTasks)[number]>();
    for (const t of allTasks) taskMap.set(t.id, t);
    const uniqueTasks = Array.from(taskMap.values());

    // Task distribution
    const taskDistribution = {
      backlog: 0,
      todo: 0,
      inProgress: 0,
      review: 0,
      done: 0,
      overdue: 0,
    };
    for (const t of uniqueTasks) {
      const status = t.status as string;
      if (status === "BACKLOG") taskDistribution.backlog++;
      else if (status === "TODO") taskDistribution.todo++;
      else if (status === "IN_PROGRESS") taskDistribution.inProgress++;
      else if (status === "REVIEW") taskDistribution.review++;
      else if (status === "DONE") taskDistribution.done++;

      if (
        t.dueDate &&
        new Date(t.dueDate) < now &&
        status !== "DONE"
      ) {
        taskDistribution.overdue++;
      }
    }

    // Time investment
    const timeInvestment = { planned: 0, actual: 0, overtimeHours: 0 };
    for (const t of uniqueTasks) {
      timeInvestment.planned += t.estimatedHours ?? 0;
      for (const te of t.timeEntries) {
        timeInvestment.actual += te.hours;
      }
    }
    timeInvestment.overtimeHours = Math.max(0, timeInvestment.actual - timeInvestment.planned);

    // Collect unique KPIs from tasks
    const kpiMap = new Map<string, {
      id: string; code: string; title: string; target: number;
      actual: number; status: string; visibility: string;
    }>();
    for (const t of uniqueTasks) {
      for (const link of t.kpiLinks) {
        kpiMap.set(link.kpi.id, link.kpi);
      }
    }
    const kpis = Array.from(kpiMap.values()).map((kpi) => {
      const achievementRate = kpi.target > 0
        ? Math.min(100, (kpi.actual / kpi.target) * 100)
        : 0;
      return {
        id: kpi.id,
        code: kpi.code,
        name: kpi.title,
        targetValue: kpi.target,
        actualValue: kpi.actual,
        achievementRate: Math.round(achievementRate * 10) / 10,
      };
    });

    const kpiAvgAchievement = kpis.length > 0
      ? kpis.reduce((sum, k) => sum + k.achievementRate, 0) / kpis.length
      : 100;
    const kpiBehindCount = kpis.filter((k) => k.achievementRate < 50).length;

    // Goal summaries
    const goals = plan.monthlyGoals.map((goal) => {
      const gTasks = goal.tasks;
      const completed = gTasks.filter((t) => t.status === "DONE").length;
      return {
        id: goal.id,
        title: goal.title,
        month: goal.month,
        completed: goal.status === "COMPLETED",
        taskCount: gTasks.length,
        completedTaskCount: completed,
      };
    });

    // Plan-level health
    const healthStatus = calculateHealthStatus(
      plan.progressPct,
      yearProgressPct,
      taskDistribution.overdue,
      uniqueTasks.length,
      kpiAvgAchievement,
      kpiBehindCount,
    );

    // Alerts
    const alerts: Alert[] = [];

    // Goal-level alerts
    for (const goal of plan.monthlyGoals) {
      const goalTimeElapsed = currentMonth >= goal.month ? 100 : ((currentMonth - 1) / goal.month) * 100;
      if (goal.progressPct < goalTimeElapsed * 0.5 && goalTimeElapsed > 50) {
        alerts.push({
          type: "CRITICAL",
          category: "GOAL",
          message: `「${goal.title}」進度 ${Math.round(goal.progressPct)}%，但月份已過 ${Math.round(goalTimeElapsed)}%`,
          targetId: goal.id,
          targetType: "GOAL",
        });
      } else if (goal.progressPct < goalTimeElapsed * 0.8 && goalTimeElapsed > 30) {
        alerts.push({
          type: "WARNING",
          category: "GOAL",
          message: `「${goal.title}」進度略落後，建議檢視`,
          targetId: goal.id,
          targetType: "GOAL",
        });
      }
    }

    // KPI alerts — consecutive misses
    for (const kpi of kpis) {
      if (kpi.achievementRate < 50) {
        alerts.push({
          type: "CRITICAL",
          category: "KPI",
          message: `${kpi.code} ${kpi.name} 達成率僅 ${kpi.achievementRate}%，遠低於目標`,
          targetId: kpi.id,
          targetType: "KPI",
        });
      }
    }

    // Overdue task alerts
    if (taskDistribution.overdue > 0) {
      alerts.push({
        type: taskDistribution.overdue > uniqueTasks.length * 0.3 ? "CRITICAL" : "WARNING",
        category: "TASK",
        message: `${taskDistribution.overdue} 個任務已逾期`,
        targetId: plan.id,
        targetType: "PLAN",
      });
    }

    // Milestone alerts
    for (const ms of plan.milestones) {
      if (ms.plannedEnd && new Date(ms.plannedEnd) < now && ms.status !== "COMPLETED") {
        alerts.push({
          type: "WARNING",
          category: "MILESTONE",
          message: `里程碑「${ms.title}」已逾期`,
          targetId: ms.id,
          targetType: "MILESTONE",
        });
      }
    }

    // Flagged task count per plan — Issue #962
    const flaggedCount = uniqueTasks.filter((t) => t.managerFlagged).length;

    // Root cause tasks for drill-down — Issue #962
    const rootCauseTasks = uniqueTasks
      .filter((t) => {
        const status = t.status as string;
        if (status === "DONE") return false;
        const isOverdue = t.dueDate && new Date(t.dueDate) < now;
        return isOverdue || t.managerFlagged;
      })
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        managerFlagged: t.managerFlagged,
        assignee: t.primaryAssignee?.name ?? null,
      }))
      .sort((a, b) => {
        if (a.managerFlagged !== b.managerFlagged) return a.managerFlagged ? -1 : 1;
        if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        return 0;
      });

    return {
      id: plan.id,
      title: plan.title,
      year: plan.year,
      progress: plan.progressPct,
      healthStatus,
      goals,
      kpis,
      taskDistribution,
      timeInvestment,
      alerts,
      flaggedCount,
      rootCauseTasks,
      milestones: plan.milestones.map((ms) => ({
        id: ms.id,
        title: ms.title,
        type: ms.type,
        plannedEnd: ms.plannedEnd.toISOString(),
        status: ms.status,
      })),
    };
  });

  return success({ plans: result });
});
