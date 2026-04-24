import { z } from "zod";

/**
 * Issue #1512 — Fixed reaction emoji palette. Kept in code (not DB)
 * so the set can evolve without a schema migration. If you add an
 * emoji, update this constant + the <ReactionBar> picker.
 */
export const REACTION_EMOJIS = ["👍", "❤️", "🎉", "🙌", "🔥", "👀"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export const REACTION_TARGETS = ["TASK_COMMENT", "DOCUMENT_COMMENT", "ACTIVITY"] as const;
export type ReactionTarget = (typeof REACTION_TARGETS)[number];

export const toggleReactionSchema = z.object({
  targetType: z.enum(REACTION_TARGETS),
  targetId: z.string().cuid(),
  emoji: z.enum(REACTION_EMOJIS),
});

export const listReactionsQuerySchema = z.object({
  targetType: z.enum(REACTION_TARGETS),
  targetId: z.string().cuid(),
});

export type ToggleReactionInput = z.infer<typeof toggleReactionSchema>;
export type ListReactionsQuery = z.infer<typeof listReactionsQuerySchema>;
