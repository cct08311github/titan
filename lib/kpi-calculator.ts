/**
 * Shared KPI achievement calculation functions.
 *
 * These pure functions centralise the KPI math that was previously
 * duplicated across route handlers and client components.
 */

export interface TaskLinkForCalc {
  weight: number;
  task: {
    status: string;
    progressPct: number;
  };
}

export interface KpiForCalc {
  target: number;
  actual: number;
  autoCalc: boolean;
  taskLinks: TaskLinkForCalc[];
}

/**
 * Calculate the achievement rate (0–100) for a single KPI.
 *
 * - autoCalc KPIs: weighted average of linked task progress, scaled by target
 * - Manual KPIs: actual / target * 100
 * - Capped at 100
 */
export function calculateAchievement(kpi: KpiForCalc): number {
  if (kpi.autoCalc && kpi.taskLinks.length > 0) {
    const totalWeight = kpi.taskLinks.reduce((sum, l) => sum + l.weight, 0);
    const weightedProgress = kpi.taskLinks.reduce((sum, l) => {
      const progress = l.task.status === "DONE" ? 100 : l.task.progressPct;
      return sum + (progress * l.weight) / 100;
    }, 0);
    const rate = totalWeight > 0 ? (weightedProgress / totalWeight) * kpi.target : 0;
    return Math.min(rate, 100);
  }
  const rate = kpi.target > 0 ? (kpi.actual / kpi.target) * 100 : 0;
  return Math.min(rate, 100);
}

/**
 * Calculate the average achievement rate across an array of KPIs.
 * Returns 0 if the array is empty. Rounded to 1 decimal place.
 */
export function calculateAvgAchievement(rates: number[]): number {
  if (rates.length === 0) return 0;
  const avg = rates.reduce((s, r) => s + r, 0) / rates.length;
  return Math.round(avg * 10) / 10;
}
