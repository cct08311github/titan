import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/services/errors";
import { withAuth } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";

export const POST = withAuth(async (req: NextRequest) => {

  const body = await req.json();
  const { taskId, title, assigneeId, dueDate, order } = body;

  if (!taskId || !title) {
    throw new ValidationError("taskId 和標題為必填");
  }

  const subtask = await prisma.subTask.create({
    data: {
      taskId,
      title,
      assigneeId: assigneeId || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      order: order ?? 0,
    },
  });

  return success(subtask, 201);
});
