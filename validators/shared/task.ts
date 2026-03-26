/**
 * Shared task schemas — Issue #396, #804 (K-2)
 *
 * Used by both:
 *   - Frontend form validation (client components)
 *   - API route validation (POST /api/tasks, PATCH /api/tasks/[id])
 *
 * Quick-add mode: only title is required (card marked "資料不完整")
 * Full mode: title + assignee + dueDate + tags are all required
 */

import { z } from "zod";
import { TaskStatusEnum, PriorityEnum, TaskCategoryEnum } from "./enums";

/**
 * Quick-add schema: only title required, other fields optional.
 * Cards created this way will be marked "資料不完整".
 */
export const createTaskSchema = z.object({
  title: z.string().min(1, "標題為必填").max(200, "標題不得超過 200 字元"),
  description: z.string().max(10000, "描述不得超過 10,000 字元").optional(),
  annualPlanId: z.string().nullable().optional(), // Issue #835
  monthlyGoalId: z.string().optional(),
  primaryAssigneeId: z.string().optional(),
  backupAssigneeId: z.string().optional(),
  status: TaskStatusEnum.optional().default("BACKLOG"),
  priority: PriorityEnum.optional().default("P2"),
  category: TaskCategoryEnum.optional().default("PLANNED"),
  dueDate: z.string().datetime().optional(),
  startDate: z.string().datetime().optional(),
  estimatedHours: z.number().nonnegative().optional(),
  tags: z.array(z.string().max(50, "標籤不得超過 50 字元")).max(20, "最多 20 個標籤").optional(),
  addedDate: z.string().datetime().optional(),
  addedReason: z.string().optional(),
  addedSource: z.string().optional(),
});

/**
 * Full create schema: all required fields must be present.
 * Used by the full task creation form.
 */
export const createTaskFullSchema = z.object({
  title: z.string().min(1, "標題為必填").max(200, "標題不得超過 200 字元"),
  description: z.string().max(10000, "描述不得超過 10,000 字元").optional(),
  annualPlanId: z.string().nullable().optional(), // Issue #835
  monthlyGoalId: z.string().optional(),
  primaryAssigneeId: z.string().min(1, "指派人為必填"),
  backupAssigneeId: z.string().optional(),
  status: TaskStatusEnum.optional().default("BACKLOG"),
  priority: PriorityEnum.optional().default("P2"),
  category: TaskCategoryEnum.optional().default("PLANNED"),
  dueDate: z.string().datetime("到期日格式不正確"),
  startDate: z.string().datetime().optional(),
  estimatedHours: z.number().nonnegative().optional(),
  tags: z.array(z.string().max(50, "標籤不得超過 50 字元")).min(1, "至少需要一個標籤").max(20, "最多 20 個標籤"),
  addedDate: z.string().datetime().optional(),
  addedReason: z.string().optional(),
  addedSource: z.string().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1, "標題為必填").max(200, "標題不得超過 200 字元").optional(),
  description: z.string().max(10000, "描述不得超過 10,000 字元").optional(),
  annualPlanId: z.string().nullable().optional(), // Issue #835
  monthlyGoalId: z.string().optional(),
  primaryAssigneeId: z.string().nullable().optional(),
  backupAssigneeId: z.string().nullable().optional(),
  status: TaskStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  category: TaskCategoryEnum.optional(),
  dueDate: z.string().datetime().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  estimatedHours: z.number().nonnegative().optional(),
  progressPct: z.number().min(0).max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  addedReason: z.string().optional(),
  addedSource: z.string().optional(),
  changedBy: z.string().optional(),
  changeReason: z.string().optional(),
});

export const updateTaskStatusSchema = z.object({
  status: TaskStatusEnum,
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type CreateTaskFullInput = z.infer<typeof createTaskFullSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
