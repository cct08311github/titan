/**
 * Recurring schedule utilities — Issue #862
 *
 * Calculates nextDueAt for RecurringRule based on frequency and schedule params.
 */

export type RecurrenceFrequency =
  | "DAILY"
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "YEARLY";

export interface RecurringSchedule {
  frequency: RecurrenceFrequency;
  dayOfWeek?: number | null;   // 0=Sun..6=Sat
  dayOfMonth?: number | null;  // 1-31
  monthOfYear?: number | null; // 1-12
  timeOfDay?: string | null;   // "HH:MM"
}

/**
 * Parse timeOfDay "HH:MM" → { hours, minutes }.
 * Returns { hours: 0, minutes: 0 } if invalid or null.
 */
function parseTime(timeOfDay?: string | null): { hours: number; minutes: number } {
  if (!timeOfDay) return { hours: 0, minutes: 0 };
  const match = timeOfDay.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return { hours: 0, minutes: 0 };
  return { hours: parseInt(match[1], 10), minutes: parseInt(match[2], 10) };
}

/**
 * Clamp dayOfMonth to the actual last day of the given month.
 * e.g. dayOfMonth=31 in February → 28 (or 29 in leap year).
 */
function clampDay(year: number, month: number, day: number): number {
  // month is 0-based for Date constructor
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(day, lastDay);
}

/**
 * Calculate the next due date after `after` for the given schedule.
 * Returns a Date representing the next occurrence.
 */
export function calculateNextDueAt(
  schedule: RecurringSchedule,
  after: Date
): Date {
  const { hours, minutes } = parseTime(schedule.timeOfDay);
  const base = new Date(after);

  switch (schedule.frequency) {
    case "DAILY": {
      const next = new Date(base);
      next.setDate(next.getDate() + 1);
      next.setHours(hours, minutes, 0, 0);
      return next;
    }

    case "WEEKLY": {
      const targetDay = schedule.dayOfWeek ?? 1; // default Monday
      const next = new Date(base);
      next.setDate(next.getDate() + 1); // at least next day
      // Advance to the target day of week
      while (next.getDay() !== targetDay) {
        next.setDate(next.getDate() + 1);
      }
      next.setHours(hours, minutes, 0, 0);
      return next;
    }

    case "BIWEEKLY": {
      const targetDay = schedule.dayOfWeek ?? 1;
      const next = new Date(base);
      next.setDate(next.getDate() + 1);
      // Find next target day
      while (next.getDay() !== targetDay) {
        next.setDate(next.getDate() + 1);
      }
      // Then add another week to make it biweekly
      next.setDate(next.getDate() + 7);
      next.setHours(hours, minutes, 0, 0);
      return next;
    }

    case "MONTHLY": {
      const targetDay = schedule.dayOfMonth ?? 1;
      const next = new Date(base);
      // Move to next month
      next.setMonth(next.getMonth() + 1);
      const clamped = clampDay(next.getFullYear(), next.getMonth(), targetDay);
      next.setDate(clamped);
      next.setHours(hours, minutes, 0, 0);
      return next;
    }

    case "QUARTERLY": {
      // Quarters: 1(Jan), 4(Apr), 7(Jul), 10(Oct)
      const targetMonth = (schedule.monthOfYear ?? 1) - 1; // 0-based
      const targetDay = schedule.dayOfMonth ?? 1;
      const next = new Date(base);

      // Quarter starting months (0-based): 0, 3, 6, 9
      const quarterStarts = [0, 3, 6, 9];
      // Find offset within quarter pattern based on targetMonth
      const quarterOffset = targetMonth % 3;

      // Find next quarter start after base
      let found = false;
      for (let q = 0; q < 8; q++) {
        // Try each quarter in the next 2 years
        const qStart = quarterStarts[q % 4];
        const yearOffset = Math.floor(q / 4);
        const candidateMonth = qStart + quarterOffset;
        const candidateYear = base.getFullYear() + yearOffset;
        const clamped = clampDay(candidateYear, candidateMonth, targetDay);
        const candidate = new Date(candidateYear, candidateMonth, clamped, hours, minutes, 0, 0);
        if (candidate > base) {
          next.setTime(candidate.getTime());
          found = true;
          break;
        }
      }
      if (!found) {
        // Fallback: 3 months from now
        next.setMonth(next.getMonth() + 3);
        next.setDate(clampDay(next.getFullYear(), next.getMonth(), targetDay));
        next.setHours(hours, minutes, 0, 0);
      }
      return next;
    }

    case "YEARLY": {
      const targetMonth = (schedule.monthOfYear ?? 1) - 1; // 0-based
      const targetDay = schedule.dayOfMonth ?? 1;
      let year = base.getFullYear();
      const clamped = clampDay(year, targetMonth, targetDay);
      let candidate = new Date(year, targetMonth, clamped, hours, minutes, 0, 0);
      if (candidate <= base) {
        year++;
        const clamped2 = clampDay(year, targetMonth, targetDay);
        candidate = new Date(year, targetMonth, clamped2, hours, minutes, 0, 0);
      }
      return candidate;
    }

    default:
      throw new Error(`Unknown frequency: ${schedule.frequency}`);
  }
}

/**
 * Resolve title template variables.
 * Supported: {date} → "YYYY/MM/DD"
 */
export function resolveTitle(template: string, date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return template.replace(/\{date\}/g, `${yyyy}/${mm}/${dd}`);
}

/**
 * Check if a RecurringRule should generate a task for the given time.
 * Returns true if isActive, nextDueAt exists, and nextDueAt <= now.
 */
export function shouldGenerate(rule: {
  isActive: boolean;
  nextDueAt: Date | null;
}, now: Date): boolean {
  if (!rule.isActive) return false;
  if (!rule.nextDueAt) return false;
  return rule.nextDueAt <= now;
}
