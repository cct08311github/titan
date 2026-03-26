import { z } from "zod";

export const createRecurringRuleSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.enum(["PLANNED", "ADDED", "INCIDENT", "SUPPORT", "ADMIN", "LEARNING"]).optional(),
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
  assigneeId: z.string().optional(),
  templateId: z.string().optional(),
  frequency: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  monthOfYear: z.number().int().min(1).max(12).optional(),
  timeOfDay: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  estimatedHours: z.number().positive().optional(),
});

export const updateRecurringRuleSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z.enum(["PLANNED", "ADDED", "INCIDENT", "SUPPORT", "ADMIN", "LEARNING"]).optional(),
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
  assigneeId: z.string().nullable().optional(),
  frequency: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]).optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  monthOfYear: z.number().int().min(1).max(12).nullable().optional(),
  timeOfDay: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
  estimatedHours: z.number().positive().nullable().optional(),
  isActive: z.boolean().optional(),
});
