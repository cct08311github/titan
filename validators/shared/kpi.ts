/**
 * Shared KPI schemas — Issue #396
 *
 * Used by both:
 *   - Frontend form validation (client components)
 *   - API route validation (POST /api/kpi, PATCH /api/kpi/[id])
 */

import { z } from "zod";
import { KpiStatusEnum } from "./enums";

export const createKpiSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  code: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  target: z.number().nonnegative(),
  weight: z.number().positive().optional().default(1),
  autoCalc: z.boolean().optional().default(false),
});

export const updateKpiSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  target: z.number().nonnegative().optional(),
  actual: z.number().nonnegative().optional(),
  weight: z.number().positive().optional(),
  status: KpiStatusEnum.optional(),
  autoCalc: z.boolean().optional(),
});

export type CreateKpiInput = z.infer<typeof createKpiSchema>;
export type UpdateKpiInput = z.infer<typeof updateKpiSchema>;
