/**
 * Reactions API — Issue #1512 (Phase 2 of team-love initiative #1505)
 *
 * POST /api/reactions  — toggle a reaction (upsert if missing, delete if exists)
 * GET  /api/reactions  — aggregated counts + reactor list for one target
 *
 * Target types: TaskComment, DocumentComment, Activity (TaskActivity).
 * One user can add multiple different emoji to the same target, but
 * each (user, target, emoji) triple is at most one row (DB unique
 * constraint). Tapping the same emoji twice removes the reaction.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { validateBody } from "@/lib/validate";
import { success, error } from "@/lib/api-response";
import {
  toggleReactionSchema,
  listReactionsQuerySchema,
  type ReactionEmoji,
} from "@/validators/reaction-validators";

/** Verify the target row exists in the correct table. */
async function targetExists(
  targetType: "TASK_COMMENT" | "DOCUMENT_COMMENT" | "ACTIVITY",
  targetId: string
): Promise<boolean> {
  switch (targetType) {
    case "TASK_COMMENT": {
      const row = await prisma.taskComment.findUnique({
        where: { id: targetId },
        select: { id: true, deletedAt: true },
      });
      return row !== null && row.deletedAt === null;
    }
    case "DOCUMENT_COMMENT": {
      const row = await prisma.documentComment.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      return row !== null;
    }
    case "ACTIVITY": {
      const row = await prisma.taskActivity.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      return row !== null;
    }
  }
}

type ReactionSummary = {
  emoji: string;
  count: number;
  userIds: string[];
  /** Whether the caller themselves reacted with this emoji. */
  reactedByMe: boolean;
};

async function summarizeTarget(
  targetType: "TASK_COMMENT" | "DOCUMENT_COMMENT" | "ACTIVITY",
  targetId: string,
  viewerId: string
): Promise<ReactionSummary[]> {
  const rows = await prisma.reaction.findMany({
    where: { targetType, targetId },
    select: { userId: true, emoji: true },
    orderBy: { createdAt: "asc" },
    take: 500, // safety cap; a single item should never accumulate this many
  });

  const byEmoji = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = byEmoji.get(r.emoji) ?? new Set<string>();
    set.add(r.userId);
    byEmoji.set(r.emoji, set);
  }

  return Array.from(byEmoji.entries()).map(([emoji, users]) => ({
    emoji,
    count: users.size,
    userIds: Array.from(users),
    reactedByMe: users.has(viewerId),
  }));
}

export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const url = new URL(req.url);
  const query = validateBody(listReactionsQuerySchema, {
    targetType: url.searchParams.get("targetType"),
    targetId: url.searchParams.get("targetId"),
  });

  if (!(await targetExists(query.targetType, query.targetId))) {
    return error("NotFoundError", "反應目標不存在", 404);
  }

  const reactions = await summarizeTarget(
    query.targetType,
    query.targetId,
    session.user.id
  );
  return success({ reactions });
});

export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const body = validateBody(toggleReactionSchema, await req.json());

  if (!(await targetExists(body.targetType, body.targetId))) {
    return error("NotFoundError", "反應目標不存在", 404);
  }

  // Toggle: delete if the exact row exists, else create.
  const existing = await prisma.reaction.findUnique({
    where: {
      userId_targetType_targetId_emoji: {
        userId: session.user.id,
        targetType: body.targetType,
        targetId: body.targetId,
        emoji: body.emoji as ReactionEmoji,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.reaction.create({
      data: {
        userId: session.user.id,
        targetType: body.targetType,
        targetId: body.targetId,
        emoji: body.emoji,
      },
    });
  }

  const reactions = await summarizeTarget(
    body.targetType,
    body.targetId,
    session.user.id
  );
  return success({ reactions, toggled: existing ? "removed" : "added" });
});
