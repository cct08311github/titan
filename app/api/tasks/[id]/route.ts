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

const taskService = new TaskService(prisma);
const auditService = new AuditService(prisma);

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
  const { id } = await context.params;
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
  const raw = await req.json();
  const { status } = validateBody(updateTaskStatusSchema, raw);
  const task = await taskService.updateTaskStatus(id, status, session.user.id);
  return success(task);
});
