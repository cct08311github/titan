import { z } from "zod";

const GoalStatusEnum = z.enum([
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const createPlanSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  title: z.string().min(1),
  description: z.string().optional(),
  implementationPlan: z.string().optional(),
  copiedFromYear: z.number().int().optional(),
});

export const updatePlanSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  implementationPlan: z.string().optional(),
  progressPct: z.number().min(0).max(100).optional(),
});

export const createGoalSchema = z.object({
  annualPlanId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  title: z.string().min(1),
  description: z.string().optional(),
});

export const updateGoalSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: GoalStatusEnum.optional(),
  progressPct: z.number().min(0).max(100).optional(),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
