import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { TaskStatus, Priority, TaskCategory } from "@prisma/client";
import { TaskService } from "@/services/task-service";
import { validateBody } from "@/lib/validate";
import { createTaskSchema } from "@/validators/task-validators";
import { success } from "@/lib/api-response";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { parsePagination, buildPaginationMeta } from "@/lib/pagination";

const taskService = new TaskService(prisma);

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);

  // Resolve "me" to the actual session userId (CR-19 / Issue #284)
  let assignee = searchParams.get("assignee") ?? undefined;
  if (assignee === "me") {
    const session = await requireAuth();
    assignee = session.user.id;
  }

  const { page, limit, skip } = parsePagination(searchParams);

  const { tasks, total } = await taskService.listTasks({
    assignee,
    status: searchParams.get("status")?.includes(",")
      ? searchParams.get("status")!.split(",") as TaskStatus[]
      : (searchParams.get("status") as TaskStatus) ?? undefined,
    priority: (searchParams.get("priority") as Priority) ?? undefined,
    category: (searchParams.get("category") as TaskCategory) ?? undefined,
    monthlyGoalId: searchParams.get("monthlyGoalId") ?? undefined,
    skip,
    take: limit,
  });

  return success({ items: tasks, pagination: buildPaginationMeta(total, { page, limit, skip }) });
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
