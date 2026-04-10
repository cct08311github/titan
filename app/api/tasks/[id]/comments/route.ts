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

const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, "評論內容不可為空")
    .max(10000, "評論不得超過 10,000 字元"),
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

  const { content } = validateBody(createCommentSchema, await req.json());
  const sanitized = sanitizeMarkdown(content);

  // Verify task exists
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true } });
  if (!task) {
    return error("NotFoundError", "任務不存在", 404);
  }

  const comment = await prisma.taskComment.create({
    data: {
      taskId,
      userId: session.user.id,
      content: sanitized,
    },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
    },
  });

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
