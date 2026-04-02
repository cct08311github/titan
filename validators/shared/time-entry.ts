/**
 * Shared time entry schemas — Issue #396
 *
 * Used by both:
 *   - Frontend form validation (client components)
 *   - API route validation (POST /api/time-entries, PATCH /api/time-entries/[id])
 */

import { z } from "zod";
import { TimeCategoryEnum } from "./enums";

/**
 * Validate hours is in 0.5hr increments.
 * Rounds to nearest 0.5 if within a small tolerance, else rejects.
 */
const hoursSchema = z.number().gt(0, "工時必須大於 0").max(24).refine(
  (val) => {
    // Allow exact 0.5 increments (with floating-point tolerance)
    const remainder = (val * 10) % 5;
    return remainder < 0.001 || remainder > 4.999;
  },
  { message: "工時必須以 0.5 小時為最小單位" }
);

/** Date must be today or earlier — no future date entries (Issue #1157) */
const pastOrTodayDate = z.string().date().refine(
  (val) => val <= new Date().toISOString().slice(0, 10),
  { message: "工時日期不可為未來日期" }
);

export const createTimeEntrySchema = z.object({
  date: pastOrTodayDate,
  hours: hoursSchema,
  taskId: z.string().nullish(),
  subTaskId: z.string().nullish(),          // Issue #933: optional subtask
  category: TimeCategoryEnum.optional().default("PLANNED_TASK"),
  description: z.string().nullish(),
});

export const updateTimeEntrySchema = z.object({
  date: pastOrTodayDate.optional(),
  hours: hoursSchema.optional(),
  taskId: z.string().optional(),
  subTaskId: z.string().nullish(),          // Issue #933: optional subtask
  category: TimeCategoryEnum.optional(),
  description: z.string().optional(),
});

/**
 * Validate daily total hours does not exceed 24.
 * @param existingDayTotal - sum of hours already recorded for the day (excluding current entry)
 * @param newHours - hours being added/updated
 * @returns error message or null if valid
 */
export function validateDailyLimit(existingDayTotal: number, newHours: number): string | null {
  const total = existingDayTotal + newHours;
  if (total > 24) {
    return `單日工時合計不可超過 24 小時（目前已有 ${existingDayTotal}h，新增 ${newHours}h = ${total}h）`;
  }
  return null;
}

export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;
export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntrySchema>;
