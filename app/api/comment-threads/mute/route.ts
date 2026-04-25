/**
 * /api/comment-threads/mute — Issue #1527
 *
 * Per-thread mute toggle. Auto-subscribed users (per #1523/#1525) can
 * silence TASK_COMMENTED notifications for one specific task or doc
 * without disabling all thread notifications globally.
 *
 * @mention notifications on the same target are unaffected.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { validateBody } from "@/lib/validate";
import { success, error } from "@/lib/api-response";

const TARGETS = ["TASK", "DOCUMENT"] as const;

const toggleSchema = z.object({
  targetType: z.enum(TARGETS),
  targetId: z.string().cuid(),
});

const querySchema = z.object({
  targetType: z.enum(TARGETS),
  targetId: z.string().cuid(),
});

export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const { targetType, targetId } = validateBody(toggleSchema, await req.json());

  // Verify target exists (avoid muting random IDs).
  if (targetType === "TASK") {
    const task = await prisma.task.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!task) return error("NotFoundError", "任務不存在", 404);
  } else {
    const doc = await prisma.document.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!doc) return error("NotFoundError", "文件不存在", 404);
  }

  const existing = await prisma.commentThreadMute.findUnique({
    where: {
      userId_targetType_targetId: {
        userId: session.user.id,
        targetType,
        targetId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.commentThreadMute.delete({ where: { id: existing.id } });
    return success({ muted: false });
  }

  await prisma.commentThreadMute.create({
    data: {
      userId: session.user.id,
      targetType,
      targetId,
    },
  });
  return success({ muted: true });
});

export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const url = new URL(req.url);
  const { targetType, targetId } = validateBody(querySchema, {
    targetType: url.searchParams.get("targetType"),
    targetId: url.searchParams.get("targetId"),
  });

  const row = await prisma.commentThreadMute.findUnique({
    where: {
      userId_targetType_targetId: {
        userId: session.user.id,
        targetType,
        targetId,
      },
    },
    select: { id: true },
  });
  return success({ muted: row !== null });
});
