import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/services/errors";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { updateSubTaskSchema } from "@/validators/subtask-validators";
import { recalcParentProgress } from "@/lib/subtask-progress";
import { AuditService } from "@/services/audit-service";
import { getClientIp } from "@/lib/get-client-ip";

const auditService = new AuditService(prisma);

export const PATCH = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const body = await req.json();
  const parsed = updateSubTaskSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => i.message).join("; "),
    );
  }

  const { done, title, assigneeId, dueDate, order, notes, result, completedAt } = parsed.data;

  // Auto-set completedAt when done changes
  let autoCompletedAt: Date | null | undefined;
  if (done === true && completedAt === undefined) {
    autoCompletedAt = new Date();
  } else if (done === false) {
    autoCompletedAt = null;
  }

  const subtask = await prisma.subTask.update({
    where: { id },
    data: {
      ...(done !== undefined && { done }),
      ...(title !== undefined && { title }),
      ...(assigneeId !== undefined && { assigneeId: assigneeId ?? null }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(order !== undefined && { order }),
      ...(notes !== undefined && { notes: notes ?? null }),
      ...(result !== undefined && { result: result ?? null }),
      ...(completedAt !== undefined && { completedAt: completedAt ? new Date(completedAt) : null }),
      ...(autoCompletedAt !== undefined && { completedAt: autoCompletedAt }),
    },
  });

  // Recalculate parent task progress when done status changes (Issue #421)
  if (done !== undefined) {
    await recalcParentProgress(subtask.taskId);
  }

  return success(subtask);
});

export const DELETE = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;

  // Get taskId before deleting so we can recalculate parent progress
  const subtask = await prisma.subTask.findUnique({
    where: { id },
    select: { taskId: true },
  });

  await prisma.subTask.delete({ where: { id } });

  // Recalculate parent task progress after subtask removal (Issue #421)
  if (subtask) {
    await recalcParentProgress(subtask.taskId);
  }

  await auditService.log({
    userId: session.user.id,
    action: "DELETE_SUBTASK",
    resourceType: "SubTask",
    resourceId: id,
    detail: null,
    ipAddress: getClientIp(req),
  });

  return success({ success: true });
});
