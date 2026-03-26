/**
 * Issue #818 — Progress auto-calculation utilities
 *
 * Plan progress = completed goals / total goals * 100
 * Rounded to nearest integer.
 */

export interface GoalForProgress {
  status: string;
}

/**
 * Calculate plan progress percentage from its goals.
 * Returns 0 if no goals exist.
 */
export function calculatePlanProgress(goals?: GoalForProgress[]): number {
  if (!goals || goals.length === 0) return 0;
  const completed = goals.filter((g) => g.status === "COMPLETED").length;
  return Math.round((completed / goals.length) * 100);
}

/**
 * Compute progress text for display.
 * Returns "未設定目標" when no goals, otherwise "XX%".
 */
export function progressDisplay(goals?: GoalForProgress[]): string {
  if (!goals || goals.length === 0) return "未設定目標";
  return `${calculatePlanProgress(goals)}%`;
}
