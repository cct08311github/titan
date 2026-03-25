/**
 * Time entry validators — re-exports from shared schemas (Issue #396)
 *
 * Kept for backward compatibility. New code should import from
 * '@/validators/shared' or '@/validators/shared/time-entry' directly.
 */

export {
  createTimeEntrySchema,
  updateTimeEntrySchema,
  type CreateTimeEntryInput,
  type UpdateTimeEntryInput,
} from "./shared/time-entry";
