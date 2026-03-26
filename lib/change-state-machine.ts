/**
 * Change Management state machine — Issue #858
 *
 * Defines valid state transitions for ChangeRecord status.
 */

export type ChangeStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "IN_PROGRESS"
  | "VERIFYING"
  | "COMPLETED"
  | "ROLLED_BACK"
  | "CANCELLED";

/**
 * Valid transitions for NORMAL and STANDARD change types.
 */
const NORMAL_TRANSITIONS: Record<string, ChangeStatus[]> = {
  DRAFT: ["PENDING_APPROVAL"],
  PENDING_APPROVAL: ["APPROVED", "CANCELLED"],
  APPROVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["VERIFYING", "ROLLED_BACK"],
  VERIFYING: ["COMPLETED", "IN_PROGRESS"],
  COMPLETED: [],
  ROLLED_BACK: [],
  CANCELLED: [],
};

/**
 * EMERGENCY changes can skip PENDING_APPROVAL:
 *   DRAFT -> APPROVED (direct)
 *   plus all normal transitions from APPROVED onward.
 */
const EMERGENCY_TRANSITIONS: Record<string, ChangeStatus[]> = {
  ...NORMAL_TRANSITIONS,
  DRAFT: ["PENDING_APPROVAL", "APPROVED"],
};

/**
 * Check if a status transition is valid.
 */
export function isValidTransition(
  currentStatus: ChangeStatus,
  targetStatus: ChangeStatus,
  changeType: string
): boolean {
  const transitions = changeType === "EMERGENCY"
    ? EMERGENCY_TRANSITIONS
    : NORMAL_TRANSITIONS;
  const allowed = transitions[currentStatus];
  return allowed ? allowed.includes(targetStatus) : false;
}

/**
 * Get all allowed target statuses from the current status.
 */
export function getAllowedTransitions(
  currentStatus: ChangeStatus,
  changeType: string
): ChangeStatus[] {
  const transitions = changeType === "EMERGENCY"
    ? EMERGENCY_TRANSITIONS
    : NORMAL_TRANSITIONS;
  return transitions[currentStatus] ?? [];
}
