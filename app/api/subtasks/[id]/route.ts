import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { UnauthorizedError } from "@/services/errors";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";

export const PATCH = apiHandler(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

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

export const DELETE = apiHandler(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const { id } = await context.params;
  await prisma.subTask.delete({ where: { id } });
  return success({ success: true });
});
