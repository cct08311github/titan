import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { TaskStatus, Priority, TaskCategory } from "@prisma/client";
import { TaskService } from "@/services/task-service";
import { validateBody } from "@/lib/validate";
import { createTaskSchema } from "@/validators/task-validators";
import { success } from "@/lib/api-response";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";

const taskService = new TaskService(prisma);

export const GET = withAuth(async (req: NextRequest) => {
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

export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();

  const raw = await req.json();
  const body = validateBody(createTaskSchema, raw);
  const task = await taskService.createTask({
    ...body,
    creatorId: session.user.id,
  });

  return success(task, 201);
});
