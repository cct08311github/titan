/**
 * Shared KPI schemas — Issue #396, enhanced Issue #821 (KP-1)
 *
 * Used by both:
 *   - Frontend form validation (client components)
 *   - API route validation (POST /api/kpi, PATCH /api/kpi/[id])
 */

import { z } from "zod";
import { KpiStatusEnum, KpiFrequencyEnum, KpiVisibilityEnum } from "./enums";

export const createKpiSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  code: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  measureMethod: z.string().optional(),
  target: z.number().nonnegative(),
  weight: z.number().positive("權重必須大於 0").max(100).optional().default(1),
  frequency: KpiFrequencyEnum.optional().default("MONTHLY"),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  unit: z.string().optional(),
  visibility: KpiVisibilityEnum.optional().default("ALL"),
  autoCalc: z.boolean().optional().default(false),
}).refine(
  (data) => {
    if (data.minValue != null && data.maxValue != null) {
      return data.minValue <= data.maxValue;
    }
    return true;
  },
  { message: "最小值不得大於最大值", path: ["minValue"] }
).refine(
  (data) => {
    if (data.minValue != null && data.target < data.minValue) return false;
    if (data.maxValue != null && data.target > data.maxValue) return false;
    return true;
  },
  { message: "目標值必須在值域範圍內", path: ["target"] }
);

export const updateKpiSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  measureMethod: z.string().optional(),
  target: z.number().nonnegative().optional(),
  actual: z.number().nonnegative().optional(),
  weight: z.number().positive("權重必須大於 0").max(100).optional(),
  frequency: KpiFrequencyEnum.optional(),
  minValue: z.number().nullable().optional(),
  maxValue: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  visibility: KpiVisibilityEnum.optional(),
  status: KpiStatusEnum.optional(),
  autoCalc: z.boolean().optional(),
});

/** Schema for KPI achievement reporting (KP-2: Issue #822) */
export const createKpiAchievementSchema = z.object({
  period: z.string().min(1, "填報週期為必填"),
  actualValue: z.number({ error: "實際值為必填" }),
  note: z.string().optional(),
});

export type CreateKpiInput = z.infer<typeof createKpiSchema>;
export type UpdateKpiInput = z.infer<typeof updateKpiSchema>;
export type CreateKpiAchievementInput = z.infer<typeof createKpiAchievementSchema>;
