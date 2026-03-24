import { z } from "zod";

const TimeCategoryEnum = z.enum([
  "PLANNED_TASK",
  "ADDED_TASK",
  "INCIDENT",
  "SUPPORT",
  "ADMIN",
  "LEARNING",
]);

export const createTimeEntrySchema = z.object({
  date: z.string().date(),
  hours: z.number().min(0).max(24),
  taskId: z.string().optional(),
  category: TimeCategoryEnum.optional().default("PLANNED_TASK"),
  description: z.string().optional(),
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
