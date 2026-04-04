import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { TaskStatus, Priority, TaskCategory } from "@prisma/client";
import { TaskService } from "@/services/task-service";
import { validateBody } from "@/lib/validate";
import { createTaskSchema } from "@/validators/task-validators";
import { success, error } from "@/lib/api-response";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { parsePagination, buildPaginationMeta } from "@/lib/pagination";

const taskService = new TaskService(prisma);

const VALID_PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3"];
const VALID_STATUSES: TaskStatus[] = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"];
const VALID_CATEGORIES: TaskCategory[] = ["PLANNED", "ADDED", "INCIDENT", "SUPPORT", "ADMIN", "LEARNING"];

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const session = await requireAuth();

  // Resolve "me" to the actual session userId (CR-19 / Issue #284)
  // Issue #1257: ENGINEER role must only see own tasks (RBAC data isolation)
  let assignee = searchParams.get("assignee") ?? undefined;
  if (assignee === "me" || session.user.role === "ENGINEER") {
    assignee = session.user.id;
  }

  // Validate enum query params before passing to Prisma (Issue #1239)
  const priorityParam = searchParams.get("priority");
  if (priorityParam && !VALID_PRIORITIES.includes(priorityParam as Priority)) {
    return error("ValidationError", `無效的優先度值：${priorityParam}，允許值為 ${VALID_PRIORITIES.join(", ")}`, 400);
  }

  const statusParam = searchParams.get("status");
  if (statusParam && !statusParam.includes(",")) {
    if (!VALID_STATUSES.includes(statusParam as TaskStatus)) {
      return error("ValidationError", `無效的狀態值：${statusParam}，允許值為 ${VALID_STATUSES.join(", ")}`, 400);
    }
  } else if (statusParam?.includes(",")) {
    const statuses = statusParam.split(",");
    const invalidStatus = statuses.find(s => !VALID_STATUSES.includes(s as TaskStatus));
    if (invalidStatus) {
      return error("ValidationError", `無效的狀態值：${invalidStatus}，允許值為 ${VALID_STATUSES.join(", ")}`, 400);
    }
  }

  const categoryParam = searchParams.get("category");
  if (categoryParam && !VALID_CATEGORIES.includes(categoryParam as TaskCategory)) {
    return error("ValidationError", `無效的類別值：${categoryParam}，允許值為 ${VALID_CATEGORIES.join(", ")}`, 400);
  }

  const { page, limit, skip } = parsePagination(searchParams);

  const { tasks, total } = await taskService.listTasks({
    assignee,
    status: searchParams.get("status")?.includes(",")
      ? searchParams.get("status")!.split(",") as TaskStatus[]
      : (searchParams.get("status") as TaskStatus) ?? undefined,
    priority: (searchParams.get("priority") as Priority) ?? undefined,
    category: (searchParams.get("category") as TaskCategory) ?? undefined,
    annualPlanId: searchParams.get("planId") ?? searchParams.get("annualPlanId") ?? undefined, // Issue #835
    monthlyGoalId: searchParams.get("monthlyGoalId") ?? searchParams.get("goalId") ?? undefined, // Issue #835: also accept goalId
    projectId: searchParams.get("projectId") ?? undefined, // Issue #1176
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
