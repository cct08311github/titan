/**
 * Comments CRUD API — Issue #805 (K-3a)
 *
 * GET    /api/tasks/:id/comments        — list comments (time ascending)
 * POST   /api/tasks/:id/comments        — create comment
 * PATCH  /api/tasks/:id/comments/:cid   — edit (own, within 5 min)
 * DELETE /api/tasks/:id/comments/:cid   — delete (own only)
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validate";
import { success, error } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { logActivity, ActivityAction, ActivityModule } from "@/services/activity-logger";
import { sanitizeMarkdown } from "@/lib/security/sanitize";
import { ForbiddenError } from "@/services/errors";
import { publishNotifications } from "@/lib/notification-publisher";

/** Max mentions per comment — hard cap to prevent notification flooding (#1506). */
const MAX_MENTIONS_PER_COMMENT = 20;

const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, "評論內容不可為空")
    .max(10000, "評論不得超過 10,000 字元"),
  mentionedUserIds: z
    .array(z.string().cuid())
    .max(MAX_MENTIONS_PER_COMMENT, `單則評論最多 @${MAX_MENTIONS_PER_COMMENT} 人`)
    .optional(),
});

const updateCommentSchema = z.object({
  content: z
    .string()
    .min(1, "評論內容不可為空")
    .max(10000, "評論不得超過 10,000 字元"),
});

/** 5 minutes in milliseconds */
const EDIT_WINDOW_MS = 5 * 60 * 1000;

export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;

  const comments = await prisma.taskComment.findMany({
    where: { taskId: id, deletedAt: null },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 500,  // safety cap for tasks with pathological comment counts
  });

  return success({ comments });
});

export const POST = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id: taskId } = await context.params;

  const { content, mentionedUserIds } = validateBody(createCommentSchema, await req.json());
  const sanitized = sanitizeMarkdown(content);

  // Verify task exists
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, title: true },
  });
  if (!task) {
    return error("NotFoundError", "任務不存在", 404);
  }

  // Deduplicate + drop self-mentions before DB lookup
  const candidateIds = Array.from(
    new Set((mentionedUserIds ?? []).filter((id) => id !== session.user.id))
  );

  // Validate mentioned users exist + are active. Silently drop unknowns
  // (user may have been deactivated between composer fetch and submit).
  const activeMentioned =
    candidateIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: candidateIds }, isActive: true },
          select: { id: true },
        })
      : [];
  const mentionedIds = activeMentioned.map((u) => u.id);

  // Atomic: create comment + mention notifications + thread-subscriber
  // notifications in a single transaction.
  const { comment, notifications } = await prisma.$transaction(async (tx) => {
    const created = await tx.taskComment.create({
      data: {
        taskId,
        userId: session.user.id,
        content: sanitized,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    });

    const preview = sanitized.substring(0, 140);
    const allCreated: Awaited<ReturnType<typeof tx.notification.create>>[] = [];

    // ── 1. Direct @mention notifications ─────────────────────────────────
    let mentionTargets: string[] = [];
    if (mentionedIds.length > 0) {
      const optedOutMention = await tx.notificationPreference.findMany({
        where: {
          userId: { in: mentionedIds },
          type: "MENTION",
          enabled: false,
        },
        select: { userId: true },
      });
      const optedOutMentionSet = new Set(optedOutMention.map((p) => p.userId));
      mentionTargets = mentionedIds.filter((id) => !optedOutMentionSet.has(id));

      if (mentionTargets.length > 0) {
        const mentionTitle = `${created.user.name} 在任務「${task.title}」中提到你`;
        const mentionRows = await Promise.all(
          mentionTargets.map((userId) =>
            tx.notification.create({
              data: {
                userId,
                type: "MENTION",
                title: mentionTitle,
                body: preview,
                relatedId: taskId,
                relatedType: "Task",
              },
            })
          )
        );
        allCreated.push(...mentionRows);
      }
    }

    // ── 2. Thread-subscriber notifications (Issue #1523) ─────────────────
    // Anyone who has previously commented on this task is implicitly
    // subscribed. Notify them about the new comment, except:
    //   - the comment author themselves
    //   - users already getting a MENTION notification this turn (avoid dup)
    //   - users opted out of TASK_COMMENTED type
    const SUBSCRIBER_CAP = 20;
    const priorCommenters = await tx.taskComment.findMany({
      where: { taskId, deletedAt: null, userId: { not: session.user.id } },
      distinct: ["userId"],
      select: { userId: true },
      take: SUBSCRIBER_CAP + 5, // small buffer; we cap after dedup with mentions
    });
    // Defense-in-depth: SQL filter excludes the author, but also drop in
    // memory in case the row leaked through.
    const candidateSubscribers = priorCommenters
      .map((r) => r.userId)
      .filter((uid) => uid !== session.user.id && !mentionTargets.includes(uid));

    let subscriberTargets: string[] = [];
    if (candidateSubscribers.length > 0) {
      // Issue #1527: drop users who muted this specific task thread.
      const muted = await tx.commentThreadMute.findMany({
        where: {
          userId: { in: candidateSubscribers },
          targetType: "TASK",
          targetId: taskId,
        },
        select: { userId: true },
      });
      const mutedSet = new Set(muted.map((m) => m.userId));

      const optedOutSub = await tx.notificationPreference.findMany({
        where: {
          userId: { in: candidateSubscribers },
          type: "TASK_COMMENTED",
          enabled: false,
        },
        select: { userId: true },
      });
      const optedOutSubSet = new Set(optedOutSub.map((p) => p.userId));
      subscriberTargets = candidateSubscribers
        .filter((uid) => !mutedSet.has(uid) && !optedOutSubSet.has(uid))
        .slice(0, SUBSCRIBER_CAP);

      if (subscriberTargets.length > 0) {
        const subTitle = `${created.user.name} 在「${task.title}」回覆了`;
        const subRows = await Promise.all(
          subscriberTargets.map((userId) =>
            tx.notification.create({
              data: {
                userId,
                type: "TASK_COMMENTED",
                title: subTitle,
                body: preview,
                relatedId: taskId,
                relatedType: "Task",
              },
            })
          )
        );
        allCreated.push(...subRows);
      }
    }

    return { comment: created, notifications: allCreated };
  });

  // Fire-and-forget SSE publish (outside tx; Redis failure must not rollback comment).
  // Wrap in try/catch so a sync-throwing publisher (or future variant) never
  // surfaces past the comment response.
  if (notifications.length > 0) {
    try {
      const publishPromise = publishNotifications(
        notifications.map((n) => ({
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
      // Swallow async rejection too.
      void Promise.resolve(publishPromise).catch(() => undefined);
    } catch {
      // Sync throw from publisher — ignore, comment already persisted.
    }
  }

  // Fire-and-forget activity log
  logActivity({
    userId: session.user.id,
    action: ActivityAction.CREATE,
    module: ActivityModule.KANBAN,
    targetType: "TaskComment",
    targetId: comment.id,
    metadata: {
      taskId,
      contentPreview: sanitized.substring(0, 100),
      mentionCount: notifications.length,
    },
  });

  return success(comment, 201);
});

export const PATCH = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const params = await context.params;
  const taskId = params.id;

  // Extract commentId from URL: /api/tasks/:id/comments/:commentId
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  const commentId = segments[segments.length - 1];

  if (!commentId || commentId === "comments") {
    return error("ValidationError", "缺少評論 ID", 400);
  }

  const comment = await prisma.taskComment.findUnique({
    where: { id: commentId },
    select: { id: true, userId: true, createdAt: true, taskId: true },
  });

  if (!comment || comment.taskId !== taskId) {
    return error("NotFoundError", "評論不存在", 404);
  }

  // Only own comments
  if (comment.userId !== session.user.id) {
    throw new ForbiddenError("只能編輯自己的評論");
  }

  // 5-minute edit window
  const elapsed = Date.now() - comment.createdAt.getTime();
  if (elapsed > EDIT_WINDOW_MS) {
    return error("ForbiddenError", "評論發布超過 5 分鐘，無法編輯", 403);
  }

  const { content } = validateBody(updateCommentSchema, await req.json());
  const sanitized = sanitizeMarkdown(content);

  const updated = await prisma.taskComment.update({
    where: { id: commentId },
    data: { content: sanitized },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
    },
  });

  // Fire-and-forget activity log
  logActivity({
    userId: session.user.id,
    action: ActivityAction.UPDATE,
    module: ActivityModule.KANBAN,
    targetType: "TaskComment",
    targetId: commentId,
    metadata: { taskId, contentPreview: sanitized.substring(0, 100) },
  });

  return success(updated);
});

export const DELETE = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const params = await context.params;
  const taskId = params.id;

  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  const commentId = segments[segments.length - 1];

  if (!commentId || commentId === "comments") {
    return error("ValidationError", "缺少評論 ID", 400);
  }

  const comment = await prisma.taskComment.findUnique({
    where: { id: commentId },
    select: { id: true, userId: true, taskId: true, deletedAt: true },
  });

  if (!comment || comment.taskId !== taskId || comment.deletedAt) {
    return error("NotFoundError", "評論不存在", 404);
  }

  // Only own comments
  if (comment.userId !== session.user.id) {
    throw new ForbiddenError("只能刪除自己的評論");
  }

  // Issue #1324: soft delete — set deletedAt instead of hard delete
  await prisma.taskComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });

  // Fire-and-forget activity log
  logActivity({
    userId: session.user.id,
    action: ActivityAction.DELETE,
    module: ActivityModule.KANBAN,
    targetType: "TaskComment",
    targetId: commentId,
    metadata: { taskId },
  });

  return success({ deleted: true });
});
