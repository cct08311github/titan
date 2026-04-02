/**
 * Task, Goal, and Milestone state machines — Banking compliance
 *
 * Enforces valid status transitions to prevent arbitrary state changes.
 * Pattern follows change-state-machine.ts and KPI inline transitions.
 *
 * Task: Forward-only workflow; DONE is terminal (Issue #1156)
 * Goal: Linear progression with terminal states
 * Milestone: Similar to Goal with DELAYED state
 */

// ── Task Status Machine ─────────────────────────────────────────────────────

export type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

/**
 * Task transitions enforce forward-only workflow:
 * - Forward: BACKLOG → TODO → IN_PROGRESS → REVIEW → DONE
 * - Revision: REVIEW → IN_PROGRESS (send back for rework)
 * - Skip: BACKLOG → IN_PROGRESS (common shortcut)
 * - DONE is terminal: cannot revert to any earlier state
 */
const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  BACKLOG: ["TODO", "IN_PROGRESS"],
  TODO: ["IN_PROGRESS"],
  IN_PROGRESS: ["REVIEW", "DONE"],
  REVIEW: ["IN_PROGRESS", "DONE"],  // IN_PROGRESS = revision
  DONE: [],                          // Terminal — no backward transitions
};

export function isValidTaskTransition(
  current: TaskStatus,
  target: TaskStatus
): boolean {
  if (current === target) return true; // No-op is always valid
  const allowed = TASK_TRANSITIONS[current];
  return allowed ? allowed.includes(target) : false;
}

export function getAllowedTaskTransitions(current: TaskStatus): TaskStatus[] {
  return TASK_TRANSITIONS[current] ?? [];
}

// ── Goal Status Machine ─────────────────────────────────────────────────────

export type GoalStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

/**
 * Goal transitions: linear progression with cancel from any state.
 * COMPLETED and CANCELLED are terminal (cannot revert).
 */
const GOAL_TRANSITIONS: Record<GoalStatus, GoalStatus[]> = {
  NOT_STARTED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],  // Terminal
  CANCELLED: [],  // Terminal
};

export function isValidGoalTransition(
  current: GoalStatus,
  target: GoalStatus
): boolean {
  if (current === target) return true;
  const allowed = GOAL_TRANSITIONS[current];
  return allowed ? allowed.includes(target) : false;
}

export function getAllowedGoalTransitions(current: GoalStatus): GoalStatus[] {
  return GOAL_TRANSITIONS[current] ?? [];
}

// ── Milestone Status Machine ────────────────────────────────────────────────

export type MilestoneStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DELAYED" | "CANCELLED";

/**
 * Milestone transitions: includes DELAYED state for overdue milestones.
 * DELAYED can recover to IN_PROGRESS or be completed directly.
 */
const MILESTONE_TRANSITIONS: Record<MilestoneStatus, MilestoneStatus[]> = {
  PENDING: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "DELAYED", "CANCELLED"],
  DELAYED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: [],  // Terminal
  CANCELLED: [],  // Terminal
};

export function isValidMilestoneTransition(
  current: MilestoneStatus,
  target: MilestoneStatus
): boolean {
  if (current === target) return true;
  const allowed = MILESTONE_TRANSITIONS[current];
  return allowed ? allowed.includes(target) : false;
}

export function getAllowedMilestoneTransitions(current: MilestoneStatus): MilestoneStatus[] {
  return MILESTONE_TRANSITIONS[current] ?? [];
}
