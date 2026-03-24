import { z } from "zod";

const GoalStatusEnum = z.enum([
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const createMonthlyGoalSchema = z.object({
  annualPlanId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  title: z.string().min(1),
  description: z.string().optional(),
});

export const updateMonthlyGoalSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: GoalStatusEnum.optional(),
  progressPct: z.number().min(0).max(100).optional(),
});

export type CreateMonthlyGoalInput = z.infer<typeof createMonthlyGoalSchema>;
export type UpdateMonthlyGoalInput = z.infer<typeof updateMonthlyGoalSchema>;
