import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { TaskService } from "@/services/task-service";
import { NotFoundError, ValidationError, UnauthorizedError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { updateTaskSchema, updateTaskStatusSchema } from "@/validators/task-validators";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";

const taskService = new TaskService(prisma);

export const GET = apiHandler(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session) throw new UnauthorizedError();
  const { id } = await context!.params;
  const task = await taskService.getTask(id);
  return success(task);
});

export const PUT = apiHandler(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();
  const { id } = await context!.params;
  const raw = await req.json();
  const body = validateBody(updateTaskSchema, raw);
  const task = await taskService.updateTask(id, body);
  return success(task);
});

export const DELETE = apiHandler(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();
  const { id } = await context!.params;
  await taskService.deleteTask(id);
  return success({ success: true });
});

export const PATCH = apiHandler(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();
  const { id } = await context!.params;
  const raw = await req.json();
  const { status } = validateBody(updateTaskStatusSchema, raw);
  const task = await taskService.updateTaskStatus(id, status, session.user.id);
  return success(task);
});
