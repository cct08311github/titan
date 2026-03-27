/**
 * Shared plan/goal schemas — Issue #396
 *
 * Used by both:
 *   - Frontend form validation (client components)
 *   - API route validation (POST /api/plans, PATCH /api/plans/[id])
 */

import { z } from "zod";
import { GoalStatusEnum } from "./enums";

export const createPlanSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  title: z.string().min(1),
  vision: z.string().optional(),
  description: z.string().optional(),
  implementationPlan: z.string().optional(),
  copiedFromYear: z.number().int().optional(),
});

export const updatePlanSchema = z.object({
  title: z.string().min(1).optional(),
  vision: z.string().nullable().optional(),
  description: z.string().optional(),
  implementationPlan: z.string().optional(),
  progressPct: z.number().min(0).max(100).optional(),
  archived: z.boolean().optional(),
});

export const createGoalSchema = z.object({
  annualPlanId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  title: z.string().min(1),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  retrospectiveNote: z.string().optional(),
});

export const updateGoalSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
  retrospectiveNote: z.string().nullable().optional(),
  status: GoalStatusEnum.optional(),
  progressPct: z.number().min(0).max(100).optional(),
});

export const copyTemplateSchema = z.object({
  sourcePlanId: z.string().min(1),
  targetYear: z.number().int().min(2000).max(2100),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type CopyTemplateInput = z.infer<typeof copyTemplateSchema>;
