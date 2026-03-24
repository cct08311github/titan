import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { UnauthorizedError, ValidationError } from "@/services/errors";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

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
