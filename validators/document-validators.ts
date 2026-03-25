import { z } from "zod";

export const createDocumentSchema = z.object({
  title: z.string().min(1),
  content: z.string().optional().default(""),
  parentId: z.string().nullish(),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().nullish(),
  parentId: z.string().nullish(),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
