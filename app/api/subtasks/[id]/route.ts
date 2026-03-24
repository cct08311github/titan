import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";

export const PATCH = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const body = await req.json();

  const subtask = await prisma.subTask.update({
    where: { id },
    data: {
      ...(body.done !== undefined && { done: body.done }),
      ...(body.title !== undefined && { title: body.title }),
      ...(body.assigneeId !== undefined && { assigneeId: body.assigneeId || null }),
      ...(body.dueDate !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
    },
  });

  return success(subtask);
});

export const DELETE = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  await prisma.subTask.delete({ where: { id } });
  return success({ success: true });
});
