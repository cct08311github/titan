/**
 * Task validators — re-exports from shared schemas (Issue #396)
 *
 * Kept for backward compatibility. New code should import from
 * '@/validators/shared' or '@/validators/shared/task' directly.
 */

export {
  createTaskSchema,
  createTaskFullSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  updateTaskDatesSchema,
  type CreateTaskInput,
  type CreateTaskFullInput,
  type UpdateTaskInput,
  type UpdateTaskStatusInput,
  type UpdateTaskDatesInput,
} from "./shared/task";
