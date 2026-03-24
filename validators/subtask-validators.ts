import { z } from "zod";

export const createSubTaskSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().min(1),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  order: z.number().int().nonnegative().optional().default(0),
});

export const updateSubTaskSchema = z.object({
  title: z.string().min(1).optional(),
  done: z.boolean().optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  order: z.number().int().nonnegative().optional(),
});

export type CreateSubTaskInput = z.infer<typeof createSubTaskSchema>;
export type UpdateSubTaskInput = z.infer<typeof updateSubTaskSchema>;
