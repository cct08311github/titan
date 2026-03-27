import { z } from "zod";

export const createReadingListSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  isDefault: z.boolean().default(false),
});

export const updateReadingListSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  isDefault: z.boolean().optional(),
});

export const addReadingListItemSchema = z.object({
  documentId: z.string().min(1),
  sortOrder: z.number().int().min(0).default(0),
  required: z.boolean().default(true),
});

export const assignReadingListSchema = z.object({
  userId: z.string().min(1),
});

export type CreateReadingListInput = z.infer<typeof createReadingListSchema>;
export type UpdateReadingListInput = z.infer<typeof updateReadingListSchema>;
export type AddReadingListItemInput = z.infer<typeof addReadingListItemSchema>;
export type AssignReadingListInput = z.infer<typeof assignReadingListSchema>;
