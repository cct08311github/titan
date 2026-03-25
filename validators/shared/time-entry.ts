/**
 * Shared time entry schemas — Issue #396
 *
 * Used by both:
 *   - Frontend form validation (client components)
 *   - API route validation (POST /api/time-entries, PATCH /api/time-entries/[id])
 */

import { z } from "zod";
import { TimeCategoryEnum } from "./enums";

export const createTimeEntrySchema = z.object({
  date: z.string().date(),
  hours: z.number().min(0).max(24),
  taskId: z.string().nullish(),
  category: TimeCategoryEnum.optional().default("PLANNED_TASK"),
  description: z.string().nullish(),
});

export const updateTimeEntrySchema = z.object({
  date: z.string().date().optional(),
  hours: z.number().min(0).max(24).optional(),
  taskId: z.string().optional(),
  category: TimeCategoryEnum.optional(),
  description: z.string().optional(),
});

export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;
export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntrySchema>;
