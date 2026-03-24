import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { TaskStatus, Priority, TaskCategory } from "@prisma/client";
import { TaskService } from "@/services/task-service";
import { UnauthorizedError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { createTaskSchema } from "@/validators/task-validators";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";

const taskService = new TaskService(prisma);

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getServerSession();
  if (!session) throw new UnauthorizedError();

  const { searchParams } = new URL(req.url);
  const tasks = await taskService.listTasks({
    assignee: searchParams.get("assignee") ?? undefined,
    status: (searchParams.get("status") as TaskStatus) ?? undefined,
    priority: (searchParams.get("priority") as Priority) ?? undefined,
    category: (searchParams.get("category") as TaskCategory) ?? undefined,
    monthlyGoalId: searchParams.get("monthlyGoalId") ?? undefined,
  });

  return success(tasks);
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const raw = await req.json();
  const body = validateBody(createTaskSchema, raw);
  const task = await taskService.createTask({
    ...body,
    creatorId: session.user.id,
  });

  return success(task, 201);
});
