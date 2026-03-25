/**
 * Shared task schemas — Issue #396
 *
 * Used by both:
 *   - Frontend form validation (client components)
 *   - API route validation (POST /api/tasks, PATCH /api/tasks/[id])
 */

import { z } from "zod";
import { TaskStatusEnum, PriorityEnum, TaskCategoryEnum } from "./enums";

export const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  monthlyGoalId: z.string().optional(),
  primaryAssigneeId: z.string().optional(),
  backupAssigneeId: z.string().optional(),
  status: TaskStatusEnum.optional().default("BACKLOG"),
  priority: PriorityEnum.optional().default("P2"),
  category: TaskCategoryEnum.optional().default("PLANNED"),
  dueDate: z.string().datetime().optional(),
  startDate: z.string().datetime().optional(),
  estimatedHours: z.number().nonnegative().optional(),
  tags: z.array(z.string()).optional(),
  addedDate: z.string().datetime().optional(),
  addedReason: z.string().optional(),
  addedSource: z.string().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
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
  tags: z.array(z.string()).optional(),
  addedReason: z.string().optional(),
  addedSource: z.string().optional(),
  changedBy: z.string().optional(),
  changeReason: z.string().optional(),
});

export const updateTaskStatusSchema = z.object({
  status: TaskStatusEnum,
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
