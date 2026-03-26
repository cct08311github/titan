/**
 * Manager Flag API — Issue #960
 *
 * PATCH /api/tasks/{id}/flag
 * Toggle manager flag on a task. MANAGER/ADMIN only.
 * Creates a Notification for the assignee and an AuditLog entry.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";
import { requireMinRole } from "@/lib/rbac";
import { NotFoundError } from "@/services/errors";
import { getClientIp } from "@/lib/get-client-ip";

export const PATCH = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireMinRole("MANAGER");
  const { id } = await context.params;

  const body = await req.json();
  const flagged: boolean = body.flagged ?? true;
  const reason: string | null = body.reason ?? null;

  // Verify task exists
  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      primaryAssigneeId: true,
      managerFlagged: true,
    },
  });

  if (!task) {
    throw new NotFoundError("任務不存在");
  }

  // Update flag fields
  const updated = await prisma.task.update({
    where: { id },
    data: {
      managerFlagged: flagged,
      flagReason: flagged ? reason : null,
      flaggedAt: flagged ? new Date() : null,
      flaggedBy: flagged ? session.user.id : null,
    },
    select: {
      id: true,
      title: true,
      managerFlagged: true,
      flagReason: true,
      flaggedAt: true,
      flaggedBy: true,
    },
  });

  // Create notification for assignee (if flagging ON and assignee exists)
  if (flagged && task.primaryAssigneeId) {
    await prisma.notification.create({
      data: {
        userId: task.primaryAssigneeId,
        type: "MANAGER_FLAG",
        title: "任務被主管標記",
        body: reason
          ? `主管標記了「${task.title}」：${reason}`
          : `主管標記了「${task.title}」為需關注項目`,
        relatedId: task.id,
        relatedType: "Task",
      },
    });
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: flagged ? "FLAG_TASK" : "UNFLAG_TASK",
      module: "KANBAN",
      resourceType: "Task",
      resourceId: id,
      detail: reason
        ? `${flagged ? "標記" : "取消標記"}任務「${task.title}」：${reason}`
        : `${flagged ? "標記" : "取消標記"}任務「${task.title}」`,
      ipAddress: getClientIp(req),
    },
  });

  return success(updated);
});
