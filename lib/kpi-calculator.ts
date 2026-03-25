/**
 * Shared KPI achievement calculation — single source of truth.
 * Used by: KPI page, achievement API, report service, export service.
 */

interface KPILike {
  target: number;
  actual: number;
  autoCalc?: boolean;
  taskLinks?: { weight: number; task: { status: string; progressPct: number } }[];
}

/** Calculate achievement rate (0–100) for a single KPI. */
export function calculateAchievement(kpi: KPILike): number {
  if (kpi.autoCalc && kpi.taskLinks && kpi.taskLinks.length > 0) {
    const totalWeight = kpi.taskLinks.reduce((s, l) => s + l.weight, 0);
    if (totalWeight === 0) return 0;
    const weighted = kpi.taskLinks.reduce((s, l) => {
      const prog = l.task.status === "DONE" ? 100 : l.task.progressPct;
      return s + (prog * l.weight) / 100;
    }, 0);
    return Math.min((weighted / totalWeight) * kpi.target, 100);
  }
  return kpi.target > 0 ? Math.min((kpi.actual / kpi.target) * 100, 100) : 0;
}

/** Calculate simple achievement rate (actual/target) without autoCalc logic. */
export function calculateSimpleAchievement(actual: number, target: number): number {
  if (target === 0) return 0;
  return Math.min((actual / target) * 100, 100);
}

/** Average achievement across multiple rates. */
export function calculateAvgAchievement(rates: number[]): number {
  if (rates.length === 0) return 0;
  return rates.reduce((sum, r) => sum + r, 0) / rates.length;
}
