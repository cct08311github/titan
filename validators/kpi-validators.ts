/**
 * KPI validators — re-exports from shared schemas (Issue #396, #821, #822)
 *
 * Kept for backward compatibility. New code should import from
 * '@/validators/shared' or '@/validators/shared/kpi' directly.
 */

export {
  createKpiSchema,
  updateKpiSchema,
  createKpiAchievementSchema,
  type CreateKpiInput,
  type UpdateKpiInput,
  type CreateKpiAchievementInput,
} from "./shared/kpi";
