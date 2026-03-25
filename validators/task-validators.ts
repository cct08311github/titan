/**
 * Task validators — re-exports from shared schemas (Issue #396)
 *
 * Kept for backward compatibility. New code should import from
 * '@/validators/shared' or '@/validators/shared/task' directly.
 */

export {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
  type UpdateTaskStatusInput,
} from "./shared/task";
