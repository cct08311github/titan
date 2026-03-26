import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validate";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { z } from "zod";

/**
 * POST /api/kudos — Give kudos to a team member (Issue #969)
 *
 * Creates a TaskActivity with action "KUDOS" on the specified task.
 */
const kudosSchema = z.object({
  taskId: z.string().min(1),
  message: z.string().max(200).optional().default(""),
});

export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const raw = await req.json();
  const { taskId, message } = validateBody(kudosSchema, raw);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, title: true, primaryAssigneeId: true },
  });
  if (!task) {
    return success({ error: "Task not found" }, 404);
  }

  const activity = await prisma.taskActivity.create({
    data: {
      taskId,
      userId: session.user.id,
      action: "KUDOS",
      detail: { message, fromUser: session.user.name ?? session.user.id },
    },
    include: {
      user: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
  });

  // Create notification for the task assignee
  if (task.primaryAssigneeId && task.primaryAssigneeId !== session.user.id) {
    await prisma.notification.create({
      data: {
        userId: task.primaryAssigneeId,
        type: "TASK_COMMENTED",
        title: "收到讚賞！",
        body: `${session.user.name ?? "同事"} 對「${task.title}」給予讚賞${message ? `：${message}` : ""}`,
        relatedId: taskId,
        relatedType: "Task",
      },
    }).catch(() => { /* fire-and-forget */ });
  }

  return success(activity, 201);
});

/**
 * GET /api/kudos?taskId=xxx — Get kudos for a specific task
 */
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("taskId");

  const where = {
    action: "KUDOS",
    ...(taskId && { taskId }),
  };

  const kudos = await prisma.taskActivity.findMany({
    where,
    include: {
      user: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return success({ items: kudos });
});
