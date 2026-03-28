import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { TaskService } from "@/services/task-service";
import { AuditService } from "@/services/audit-service";
import { validateBody } from "@/lib/validate";
import { updateTaskSchema, updateTaskStatusSchema } from "@/validators/task-validators";
import { success } from "@/lib/api-response";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireAuth, requireRole } from "@/lib/rbac";
import { getClientIp } from "@/lib/get-client-ip";
import { ForbiddenError, NotFoundError } from "@/services/errors";

const taskService = new TaskService(prisma);
const auditService = new AuditService(prisma);

/**
 * ENGINEER 只能修改自己被指派的任務（primaryAssignee 或 backupAssignee）。
 * MANAGER 可修改任何任務。
 */
async function enforceTaskOwnership(userId: string, role: string, taskId: string): Promise<void> {
  if (role === "MANAGER") return;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { primaryAssigneeId: true, backupAssigneeId: true, creatorId: true },
  });

  if (!task) {
    throw new NotFoundError("任務不存在");
  }

  const isOwner = task.primaryAssigneeId === userId
    || task.backupAssigneeId === userId
    || (task as Record<string, unknown>).creatorId === userId;
  if (!isOwner) {
    throw new ForbiddenError("僅能修改自己被指派或建立的任務");
  }
}

export const GET = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const task = await taskService.getTask(id);
  return success(task);
});

export const PUT = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;
  await enforceTaskOwnership(session.user.id, session.user.role, id);
  const raw = await req.json();
  const body = validateBody(updateTaskSchema, raw);
  const task = await taskService.updateTask(id, body);
  return success(task);
});

export const DELETE = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireRole("MANAGER");
  const { id } = await context.params;
  await taskService.deleteTask(id);

  await auditService.log({
    userId: session.user.id,
    action: "DELETE_TASK",
    resourceType: "Task",
    resourceId: id,
    detail: null,
    ipAddress: getClientIp(req),
  });

  return success({ success: true });
});

export const PATCH = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;
  await enforceTaskOwnership(session.user.id, session.user.role, id);
  const raw = await req.json();
  const { status } = validateBody(updateTaskStatusSchema, raw);
  const task = await taskService.updateTaskStatus(id, status, session.user.id);
  return success(task);
});
