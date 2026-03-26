/**
 * Overdue task utilities — Issue #809 (D-3)
 *
 * Overdue definition: dueDate 23:59:59 (Asia/Taipei) has passed,
 * and the task status is NOT "DONE".
 *
 * Asia/Taipei is always UTC+8 (no DST).
 */

/**
 * Check if a task is overdue based on its dueDate and status.
 * A task is overdue when:
 * - dueDate is not null
 * - Current time > dueDate 23:59:59 in Asia/Taipei (UTC+8)
 * - Status is not DONE
 */
export function isOverdue(
  dueDate: string | Date | null | undefined,
  status: string
): boolean {
  if (!dueDate) return false;
  if (status === "DONE") return false;

  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return false;

  // Get end of day in Asia/Taipei (UTC+8)
  // Set due date to 23:59:59.999 in Taipei time, then convert to UTC
  const taipeiStr = due.toLocaleDateString("en-US", { timeZone: "Asia/Taipei" });
  const taipeiDay = new Date(taipeiStr);
  taipeiDay.setHours(23, 59, 59, 999);

  // Convert back to UTC by subtracting UTC+8 offset
  const endOfDayUtc = new Date(taipeiDay.getTime() - 8 * 60 * 60 * 1000);

  return new Date() > endOfDayUtc;
}

/**
 * Calculate the number of overdue days (in Asia/Taipei timezone).
 * Returns 0 if not overdue.
 */
export function overdueDays(
  dueDate: string | Date | null | undefined,
  status: string
): number {
  if (!isOverdue(dueDate, status)) return 0;

  const due = new Date(dueDate!);
  const now = new Date();

  // Get today's date in Asia/Taipei
  const nowTaipeiStr = now.toLocaleDateString("en-US", { timeZone: "Asia/Taipei" });
  const nowTaipei = new Date(nowTaipeiStr);

  // Get due date in Asia/Taipei
  const dueTaipeiStr = due.toLocaleDateString("en-US", { timeZone: "Asia/Taipei" });
  const dueTaipei = new Date(dueTaipeiStr);

  const diffMs = nowTaipei.getTime() - dueTaipei.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
