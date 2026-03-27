/**
 * Zod validators for Reports v2 API — Issue #984
 */
import { z } from "zod";

/** Reusable date-range query params */
export const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "格式: YYYY-MM-DD").optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "格式: YYYY-MM-DD").optional(),
});

/** Year-only query param */
export const yearSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
});

/** Earned value needs planId */
export const earnedValueSchema = z.object({
  planId: z.string().min(1, "planId 為必填"),
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "格式: YYYY-MM-DD").optional(),
});

/** KPI trend can optionally filter by kpiId */
export const kpiTrendSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  kpiId: z.string().optional(),
});

export type DateRangeQuery = z.infer<typeof dateRangeSchema>;
export type YearQuery = z.infer<typeof yearSchema>;
export type EarnedValueQuery = z.infer<typeof earnedValueSchema>;
export type KpiTrendQuery = z.infer<typeof kpiTrendSchema>;

/** Parse search params into an object for Zod validation */
export function searchParamsToObject(searchParams: URLSearchParams): Record<string, string> {
  const obj: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}
