/**
 * Plan validators — re-exports from shared schemas (Issue #396)
 *
 * Kept for backward compatibility. New code should import from
 * '@/validators/shared' or '@/validators/shared/plan' directly.
 */

export {
  createPlanSchema,
  updatePlanSchema,
  createGoalSchema,
  updateGoalSchema,
  copyTemplateSchema,
  type CreatePlanInput,
  type UpdatePlanInput,
  type CreateGoalInput,
  type UpdateGoalInput,
  type CopyTemplateInput,
} from "./shared/plan";
