/**
 * KPI validators — re-exports from shared schemas (Issue #396)
 *
 * Kept for backward compatibility. New code should import from
 * '@/validators/shared' or '@/validators/shared/kpi' directly.
 */

export {
  createKpiSchema,
  updateKpiSchema,
  type CreateKpiInput,
  type UpdateKpiInput,
} from "./shared/kpi";
