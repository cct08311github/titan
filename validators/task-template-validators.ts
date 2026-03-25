import { z } from "zod";

const PriorityEnum = z.enum(["P0", "P1", "P2", "P3"]);

const TaskCategoryEnum = z.enum([
  "PLANNED",
  "ADDED",
  "INCIDENT",
  "SUPPORT",
  "ADMIN",
  "LEARNING",
]);

export const createTaskTemplateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: PriorityEnum.optional().default("P2"),
  category: TaskCategoryEnum.optional().default("PLANNED"),
  estimatedHours: z.number().nonnegative().optional(),
});

export type CreateTaskTemplateInput = z.infer<typeof createTaskTemplateSchema>;
