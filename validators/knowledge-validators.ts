import { z } from "zod";

// ── SpaceMember ──

export const addSpaceMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["OWNER", "EDITOR", "VIEWER"]).default("VIEWER"),
});

// ── KnowledgeCategory ──

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  parentId: z.string().nullish(),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).optional(),
  parentId: z.string().nullish(),
  sortOrder: z.number().int().min(0).optional(),
});

// ── DocumentAttachment ──

export const createDocAttachmentSchema = z.object({
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  fileSize: z.number().int().min(0),
  mimeType: z.string().min(1),
});

// ── DocumentComment ──

export const createDocCommentSchema = z.object({
  content: z.string().min(1),
  parentId: z.string().nullish(),
  /** Issue #1506: users to notify via @mention. Max 20 per comment. */
  mentionedUserIds: z.array(z.string().cuid()).max(20).optional(),
});

// ── DocumentLink ──

export const createDocLinkSchema = z.object({
  targetDocId: z.string().min(1),
  linkType: z.enum(["REFERENCE", "RELATED"]).default("REFERENCE"),
});

// ── Type exports ──

export type AddSpaceMemberInput = z.infer<typeof addSpaceMemberSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateDocAttachmentInput = z.infer<typeof createDocAttachmentSchema>;
export type CreateDocCommentInput = z.infer<typeof createDocCommentSchema>;
export type CreateDocLinkInput = z.infer<typeof createDocLinkSchema>;
