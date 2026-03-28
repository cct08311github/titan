/**
 * Task, Goal, and Milestone state machines — Banking compliance
 *
 * Enforces valid status transitions to prevent arbitrary state changes.
 * Pattern follows change-state-machine.ts and KPI inline transitions.
 *
 * Task: Kanban-style workflow with ability to reopen from DONE
 * Goal: Linear progression with terminal states
 * Milestone: Similar to Goal with DELAYED state
 */

// ── Task Status Machine ─────────────────────────────────────────────────────

export type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

/**
 * Task transitions allow flexible Kanban-style movement:
 * - Forward: BACKLOG → TODO → IN_PROGRESS → REVIEW → DONE
 * - Backward: Any non-DONE state can move to any earlier state
 * - Reopen: DONE → TODO (controlled, requires audit)
 * - Skip: BACKLOG → IN_PROGRESS (common shortcut)
 */
const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  BACKLOG: ["TODO", "IN_PROGRESS"],
  TODO: ["BACKLOG", "IN_PROGRESS", "REVIEW"],
  IN_PROGRESS: ["TODO", "REVIEW", "DONE", "BACKLOG"],
  REVIEW: ["IN_PROGRESS", "DONE", "TODO"],
  DONE: ["TODO"], // Reopen only to TODO (controlled)
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
