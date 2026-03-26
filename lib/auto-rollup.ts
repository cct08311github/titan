/**
 * Auto-Rollup Service — Issue #965
 *
 * When a task status changes, automatically recalculate:
 *   Task → MonthlyGoal.progressPct → AnnualPlan.progressPct → KPI.actual
 *
 * Called synchronously from task update API (no async queue).
 */

import { PrismaClient } from "@prisma/client";

export class AutoRollupService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Main entry point: given a task ID, recalculate all upstream aggregates.
   * Safe to call even if task has no goal/plan/KPI links — will no-op gracefully.
   */
  async executeRollup(taskId: string): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        monthlyGoalId: true,
        kpiLinks: { select: { kpiId: true } },
      },
    });

    if (!task) return;

    // 1. Rollup to MonthlyGoal → AnnualPlan
    if (task.monthlyGoalId) {
      await this.recalculateGoalProgress(task.monthlyGoalId);

      // Get the plan ID from the goal to rollup plan progress
      const goal = await this.prisma.monthlyGoal.findUnique({
        where: { id: task.monthlyGoalId },
        select: { annualPlanId: true },
      });

      if (goal?.annualPlanId) {
        await this.recalculatePlanProgress(goal.annualPlanId);
      }
    }

    // 2. Rollup to linked KPIs
    if (task.kpiLinks.length > 0) {
      for (const link of task.kpiLinks) {
        await this.recalculateKPIActual(link.kpiId);
      }
    }
  }

  /**
   * Recalculate MonthlyGoal.progressPct based on task completion ratio.
   * Formula: (done tasks / total tasks) * 100
   */
  async recalculateGoalProgress(goalId: string): Promise<number> {
    const tasks = await this.prisma.task.findMany({
      where: { monthlyGoalId: goalId },
      select: { status: true },
    });

    if (tasks.length === 0) {
      // No tasks — keep progress at 0
      await this.prisma.monthlyGoal.update({
        where: { id: goalId },
        data: { progressPct: 0 },
      });
      return 0;
    }

    const doneCount = tasks.filter((t) => t.status === "DONE").length;
    const progressPct = Math.round((doneCount / tasks.length) * 10000) / 100; // 2 decimal places

    await this.prisma.monthlyGoal.update({
      where: { id: goalId },
      data: { progressPct },
    });

    return progressPct;
  }

  /**
   * Recalculate AnnualPlan.progressPct as average of all goals' progressPct.
   */
  async recalculatePlanProgress(planId: string): Promise<number> {
    const goals = await this.prisma.monthlyGoal.findMany({
      where: { annualPlanId: planId },
      select: { progressPct: true },
    });

    if (goals.length === 0) {
      await this.prisma.annualPlan.update({
        where: { id: planId },
        data: { progressPct: 0 },
      });
      return 0;
    }

    const avgProgress =
      Math.round(
        (goals.reduce((sum, g) => sum + g.progressPct, 0) / goals.length) * 100
      ) / 100; // 2 decimal places

    await this.prisma.annualPlan.update({
      where: { id: planId },
      data: { progressPct: avgProgress },
    });

    return avgProgress;
  }

  /**
   * Recalculate KPI.actual based on weighted average of linked tasks' progressPct.
   * Formula: sum(task.progressPct * link.weight) / sum(link.weight) * (kpi.target / 100)
   *
   * For DONE tasks, progressPct is treated as 100%.
   */
  async recalculateKPIActual(kpiId: string): Promise<number> {
    const kpi = await this.prisma.kPI.findUnique({
      where: { id: kpiId },
      select: {
        id: true,
        target: true,
        autoCalc: true,
        taskLinks: {
          select: {
            weight: true,
            task: { select: { status: true, progressPct: true } },
          },
        },
      },
    });

    if (!kpi || !kpi.autoCalc || kpi.taskLinks.length === 0) return 0;

    const totalWeight = kpi.taskLinks.reduce((sum, l) => sum + l.weight, 0);
    if (totalWeight === 0) return 0;

    const weightedProgress = kpi.taskLinks.reduce((sum, link) => {
      const progress = link.task.status === "DONE" ? 100 : link.task.progressPct;
      return sum + (progress * link.weight);
    }, 0);

    // Weighted average progress (0-100), then scale to KPI target
    const avgProgress = weightedProgress / totalWeight;
    const actual = Math.round((avgProgress / 100) * kpi.target * 100) / 100;

    await this.prisma.kPI.update({
      where: { id: kpiId },
      data: { actual },
    });

    return actual;
  }
}
