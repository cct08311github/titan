/**
 * POST /api/undo — Undo soft delete (Issue #1324)
 *
 * Restores a soft-deleted Task, TaskComment, Document, or KPI
 * by clearing its deletedAt field.
 *
 * Rules:
 * - Only works within 24 hours of deletion.
 * - ENGINEER: can only undo their own records (by creatorId / userId).
 * - MANAGER or above: can undo any record.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validate";
import { success, error } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { hasMinimumRole } from "@/lib/auth/permissions";
import { logActivity, ActivityAction, ActivityModule } from "@/services/activity-logger";

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

const undoSchema = z.object({
  resourceType: z.enum(["Task", "TaskComment", "Document", "KPI"]),
  resourceId: z.string().min(1),
});

export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const { resourceType, resourceId } = validateBody(undoSchema, await req.json());
  const isManager = hasMinimumRole(session.user.role, "MANAGER");

  switch (resourceType) {
    case "Task": {
      const task = await prisma.task.findUnique({
        where: { id: resourceId },
        select: { id: true, title: true, deletedAt: true, creatorId: true, primaryAssigneeId: true },
      });
      if (!task || !task.deletedAt) {
        return error("NotFoundError", "任務不存在或未被刪除", 404);
      }
      if (!isManager && task.creatorId !== session.user.id && task.primaryAssigneeId !== session.user.id) {
        return error("ForbiddenError", "無權限復原此任務", 403);
      }
      const elapsed = Date.now() - task.deletedAt.getTime();
      if (elapsed > UNDO_WINDOW_MS) {
        return error("ForbiddenError", "刪除超過 24 小時，無法復原", 403);
      }
      await prisma.task.update({ where: { id: resourceId }, data: { deletedAt: null } });
      logActivity({
        userId: session.user.id,
        action: ActivityAction.UPDATE,
        module: ActivityModule.KANBAN,
        targetType: "Task",
        targetId: resourceId,
        metadata: { action: "undo_delete", title: task.title },
      });
      return success({ restored: true, resourceType, resourceId });
    }

    case "TaskComment": {
      const comment = await prisma.taskComment.findUnique({
        where: { id: resourceId },
        select: { id: true, userId: true, deletedAt: true },
      });
      if (!comment || !comment.deletedAt) {
        return error("NotFoundError", "評論不存在或未被刪除", 404);
      }
      if (!isManager && comment.userId !== session.user.id) {
        return error("ForbiddenError", "無權限復原此評論", 403);
      }
      const elapsed = Date.now() - comment.deletedAt.getTime();
      if (elapsed > UNDO_WINDOW_MS) {
        return error("ForbiddenError", "刪除超過 24 小時，無法復原", 403);
      }
      await prisma.taskComment.update({ where: { id: resourceId }, data: { deletedAt: null } });
      logActivity({
        userId: session.user.id,
        action: ActivityAction.UPDATE,
        module: ActivityModule.KANBAN,
        targetType: "TaskComment",
        targetId: resourceId,
        metadata: { action: "undo_delete" },
      });
      return success({ restored: true, resourceType, resourceId });
    }

    case "Document": {
      const doc = await prisma.document.findUnique({
        where: { id: resourceId },
        select: { id: true, title: true, createdBy: true, deletedAt: true },
      });
      if (!doc || !doc.deletedAt) {
        return error("NotFoundError", "文件不存在或未被刪除", 404);
      }
      if (!isManager && doc.createdBy !== session.user.id) {
        return error("ForbiddenError", "無權限復原此文件", 403);
      }
      const elapsed = Date.now() - doc.deletedAt.getTime();
      if (elapsed > UNDO_WINDOW_MS) {
        return error("ForbiddenError", "刪除超過 24 小時，無法復原", 403);
      }
      await prisma.document.update({ where: { id: resourceId }, data: { deletedAt: null } });
      logActivity({
        userId: session.user.id,
        action: ActivityAction.UPDATE,
        module: ActivityModule.KANBAN,
        targetType: "Document",
        targetId: resourceId,
        metadata: { action: "undo_delete", title: doc.title },
      });
      return success({ restored: true, resourceType, resourceId });
    }

    case "KPI": {
      const kpi = await prisma.kPI.findUnique({
        where: { id: resourceId },
        select: { id: true, title: true, createdBy: true, deletedAt: true },
      });
      if (!kpi || !kpi.deletedAt) {
        return error("NotFoundError", "KPI 不存在或未被刪除", 404);
      }
      if (!isManager && kpi.createdBy !== session.user.id) {
        return error("ForbiddenError", "無權限復原此 KPI", 403);
      }
      const elapsed = Date.now() - kpi.deletedAt.getTime();
      if (elapsed > UNDO_WINDOW_MS) {
        return error("ForbiddenError", "刪除超過 24 小時，無法復原", 403);
      }
      await prisma.kPI.update({ where: { id: resourceId }, data: { deletedAt: null } });
      logActivity({
        userId: session.user.id,
        action: ActivityAction.UPDATE,
        module: ActivityModule.KANBAN,
        targetType: "KPI",
        targetId: resourceId,
        metadata: { action: "undo_delete", title: kpi.title },
      });
      return success({ restored: true, resourceType, resourceId });
    }

    default:
      return error("ValidationError", "不支援的資源類型", 400);
  }
});
