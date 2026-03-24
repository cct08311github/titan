import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/services/errors";
import { withAuth } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";
import { createSubTaskSchema } from "@/validators/subtask-validators";

export const POST = withAuth(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = createSubTaskSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => i.message).join("; "),
    );
  }

  const { taskId, title, assigneeId, dueDate, order } = parsed.data;

  const subtask = await prisma.subTask.create({
    data: {
      taskId,
      title,
      assigneeId: assigneeId ?? null,
      dueDate: dueDate ? new Date(dueDate) : null,
      order,
    },
  });

  return success(subtask, 201);
});
