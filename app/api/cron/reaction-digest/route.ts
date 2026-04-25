/**
 * POST /api/cron/reaction-digest — Issue #1520 (Phase 2.1 of #1505)
 *
 * Aggregates the last 24h of Reactions and emits one batched
 * Notification per recipient summarizing who reacted to their
 * comments + activity items.
 *
 * Why batch: real-time push for every individual reaction would create
 * exactly the kind of notification noise reactions are supposed to
 * replace. A daily digest at a predictable time gives the recipient
 * the affirmation without the spam.
 *
 * Protected by CRON_SECRET. Per-day idempotent: if a REACTION_DIGEST
 * notification already exists for a user today, skip.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { verifyCronSecret } from "@/lib/cron-auth";
import { getRedisClient } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { publishNotifications } from "@/lib/notification-publisher";

const LOCK_KEY = "cron:reaction-digest:lock";
const LOCK_TTL = 300; // 5 minutes

const TARGET_TYPES = ["TASK_COMMENT", "DOCUMENT_COMMENT", "ACTIVITY"] as const;
type TargetType = (typeof TARGET_TYPES)[number];

interface ReactionRow {
  userId: string;     // reactor
  targetType: TargetType;
  targetId: string;
  emoji: string;
}

/**
 * Resolve the recipient (creator) for each reaction target. Returns a
 * map keyed by `${targetType}:${targetId}` → creator userId. Targets
 * whose row was deleted are dropped.
 */
async function resolveRecipients(
  rows: ReactionRow[]
): Promise<Map<string, string>> {
  const idsByType: Record<TargetType, Set<string>> = {
    TASK_COMMENT: new Set(),
    DOCUMENT_COMMENT: new Set(),
    ACTIVITY: new Set(),
  };
  for (const r of rows) idsByType[r.targetType].add(r.targetId);

  const [taskComments, docComments, activities] = await Promise.all([
    idsByType.TASK_COMMENT.size > 0
      ? prisma.taskComment.findMany({
          where: { id: { in: Array.from(idsByType.TASK_COMMENT) } },
          select: { id: true, userId: true },
        })
      : Promise.resolve([]),
    idsByType.DOCUMENT_COMMENT.size > 0
      ? prisma.documentComment.findMany({
          where: { id: { in: Array.from(idsByType.DOCUMENT_COMMENT) } },
          select: { id: true, authorId: true },
        })
      : Promise.resolve([]),
    idsByType.ACTIVITY.size > 0
      ? prisma.taskActivity.findMany({
          where: { id: { in: Array.from(idsByType.ACTIVITY) } },
          select: { id: true, userId: true },
        })
      : Promise.resolve([]),
  ]);

  const map = new Map<string, string>();
  for (const tc of taskComments) map.set(`TASK_COMMENT:${tc.id}`, tc.userId);
  for (const dc of docComments) map.set(`DOCUMENT_COMMENT:${dc.id}`, dc.authorId);
  for (const a of activities) map.set(`ACTIVITY:${a.id}`, a.userId);
  return map;
}

interface RecipientGroup {
  reactorIds: Set<string>;
  byEmoji: Map<string, Set<string>>; // emoji → reactor ids
  totalReactions: number;
}

function buildGroups(
  rows: ReactionRow[],
  recipientByTarget: Map<string, string>
): Map<string, RecipientGroup> {
  const groups = new Map<string, RecipientGroup>();
  for (const r of rows) {
    const recipient = recipientByTarget.get(`${r.targetType}:${r.targetId}`);
    if (!recipient) continue;
    if (recipient === r.userId) continue; // skip self-reactions
    let g = groups.get(recipient);
    if (!g) {
      g = { reactorIds: new Set(), byEmoji: new Map(), totalReactions: 0 };
      groups.set(recipient, g);
    }
    g.reactorIds.add(r.userId);
    g.totalReactions += 1;
    const set = g.byEmoji.get(r.emoji) ?? new Set<string>();
    set.add(r.userId);
    g.byEmoji.set(r.emoji, set);
  }
  return groups;
}

function formatBody(g: RecipientGroup, names: Map<string, string>): string {
  // "👍 3 個（Alice、Bob、Charlie）／ ❤️ 2 個（David、Eve）"
  const parts: string[] = [];
  for (const [emoji, users] of g.byEmoji.entries()) {
    const named = Array.from(users).slice(0, 3).map((id) => names.get(id) ?? id);
    const extra = users.size > 3 ? ` 等 ${users.size} 人` : "";
    parts.push(`${emoji} ${users.size} 個（${named.join("、")}${extra}）`);
  }
  return parts.join(" ／ ");
}

export const POST = apiHandler(async (req: NextRequest) => {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const redis = getRedisClient();
  if (redis) {
    const acquired = await redis.set(LOCK_KEY, "1", "EX", LOCK_TTL, "NX");
    if (!acquired) {
      logger.warn(
        { event: "cron_reaction_digest_skipped" },
        "Skipped: previous run still active"
      );
      return success({ skipped: true, reason: "lock_held" });
    }
  }

  try {
    const now = new Date();
    const since = new Date(now);
    since.setHours(now.getHours() - 24);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const reactions: ReactionRow[] = await prisma.reaction.findMany({
      where: { createdAt: { gte: since } },
      select: { userId: true, targetType: true, targetId: true, emoji: true },
    });

    if (reactions.length === 0) {
      return success({ inserted: 0, recipients: 0 });
    }

    const recipientByTarget = await resolveRecipients(reactions);
    const groups = buildGroups(reactions, recipientByTarget);

    if (groups.size === 0) {
      return success({ inserted: 0, recipients: 0 });
    }

    const recipientIds = Array.from(groups.keys());

    // Skip recipients who already received a REACTION_DIGEST today
    // (per-day idempotency without a separate ledger).
    const existing = await prisma.notification.findMany({
      where: {
        userId: { in: recipientIds },
        type: "REACTION_DIGEST",
        createdAt: { gte: todayStart },
      },
      select: { userId: true },
    });
    const alreadySent = new Set(existing.map((n) => n.userId));

    // Honor per-user opt-out for REACTION_DIGEST.
    const optedOut = await prisma.notificationPreference.findMany({
      where: {
        userId: { in: recipientIds },
        type: "REACTION_DIGEST",
        enabled: false,
      },
      select: { userId: true },
    });
    const optedOutSet = new Set(optedOut.map((p) => p.userId));

    // Resolve display names for body text.
    const reactorIds = new Set<string>();
    for (const g of groups.values()) {
      for (const id of g.reactorIds) reactorIds.add(id);
    }
    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(reactorIds) } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(users.map((u) => [u.id, u.name]));

    const created: Array<{
      id: string;
      userId: string;
      type: string;
      title: string;
      body: string | null;
      isRead: boolean;
      createdAt: Date;
      relatedId: string | null;
      relatedType: string | null;
    }> = [];

    for (const [recipientId, g] of groups.entries()) {
      if (alreadySent.has(recipientId) || optedOutSet.has(recipientId)) continue;
      const title = `${g.reactorIds.size} 人對你的內容做了反應`;
      const body = formatBody(g, nameMap);
      const n = await prisma.notification.create({
        data: {
          userId: recipientId,
          type: "REACTION_DIGEST",
          title,
          body,
          relatedId: recipientId,
          relatedType: "User",
        },
      });
      created.push(n);
    }

    if (created.length > 0) {
      try {
        await publishNotifications(
          created.map((n) => ({
            id: n.id,
            userId: n.userId,
            type: n.type,
            title: n.title,
            body: n.body,
            isRead: n.isRead,
            createdAt: n.createdAt,
            relatedId: n.relatedId,
            relatedType: n.relatedType,
          }))
        );
      } catch (err) {
        logger.warn({ err }, "[reaction-digest] publish failed (non-fatal)");
      }
    }

    return success({
      inserted: created.length,
      recipients: groups.size,
      skipped_already_sent: alreadySent.size,
      skipped_opted_out: optedOutSet.size,
    });
  } finally {
    if (redis) {
      try {
        await redis.del(LOCK_KEY);
      } catch {
        // swallow
      }
    }
  }
});
