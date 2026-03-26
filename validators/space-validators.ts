import { z } from "zod";

export const createSpaceSchema = z.object({
  name: z.string().min(1, "名稱為必填").max(100),
  description: z.string().max(500).optional(),
});

export const updateSpaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullish(),
});

export type CreateSpaceInput = z.infer<typeof createSpaceSchema>;
export type UpdateSpaceInput = z.infer<typeof updateSpaceSchema>;
