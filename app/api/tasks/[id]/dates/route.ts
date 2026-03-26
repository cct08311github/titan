/**
 * PATCH /api/tasks/:id/dates — Issue #844 (G-3)
 *
 * Updates task startDate/dueDate from Gantt chart drag interactions.
 * Validates start <= end, enforces task ownership, logs activity.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { TaskService } from "@/services/task-service";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { validateBody } from "@/lib/validate";
import { updateTaskDatesSchema } from "@/validators/task-validators";
import { success } from "@/lib/api-response";
import { ForbiddenError, NotFoundError } from "@/services/errors";
import { logActivity, ActivityAction, ActivityModule } from "@/services/activity-logger";

const taskService = new TaskService(prisma);

async function enforceTaskOwnership(userId: string, role: string, taskId: string): Promise<void> {
  if (role === "MANAGER" || role === "ADMIN") return;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { primaryAssigneeId: true, backupAssigneeId: true },
  });

  if (!task) throw new NotFoundError("任務不存在");

  if (task.primaryAssigneeId !== userId && task.backupAssigneeId !== userId) {
    throw new ForbiddenError("僅能修改自己被指派的任務");
  }
}

export const PATCH = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;
  await enforceTaskOwnership(session.user.id, session.user.role, id);

  const raw = await req.json();
  const data = validateBody(updateTaskDatesSchema, raw);

  // Get existing task for activity log
  const existing = await prisma.task.findUnique({
    where: { id },
    select: { startDate: true, dueDate: true },
  });

  const updates: Record<string, unknown> = {};
  if (data.startDate !== undefined) {
    updates.startDate = data.startDate ? new Date(data.startDate) : null;
  }
  if (data.dueDate !== undefined) {
    updates.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  }

  const task = await prisma.task.update({
    where: { id },
    data: updates,
    include: {
      primaryAssignee: { select: { id: true, name: true, avatar: true } },
      backupAssignee: { select: { id: true, name: true, avatar: true } },
    },
  });

  // Log activity (fire-and-forget)
  logActivity({
    userId: session.user.id,
    action: ActivityAction.UPDATE,
    module: ActivityModule.GANTT,
    targetType: "Task",
    targetId: id,
    metadata: {
      action: "GANTT_DATE_CHANGE",
      oldStartDate: existing?.startDate?.toISOString() ?? null,
      oldDueDate: existing?.dueDate?.toISOString() ?? null,
      newStartDate: data.startDate ?? null,
      newDueDate: data.dueDate ?? null,
    },
  });

  return success(task);
});
