import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { UnauthorizedError, ValidationError } from "@/services/errors";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";

export const GET = apiHandler(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const { id } = await context!.params;
  const changes = await prisma.taskChange.findMany({
    where: { taskId: id },
    include: {
      changedByUser: { select: { id: true, name: true } },
    },
    orderBy: { changedAt: "desc" },
  });

  return success(changes);
});

export const POST = apiHandler(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const { id } = await context!.params;
  const body = await req.json();
  const { changeType, reason, oldValue, newValue } = body;

  if (!changeType || !reason) {
    throw new ValidationError("changeType 和 reason 為必填");
  }

  const change = await prisma.taskChange.create({
    data: {
      taskId: id,
      changeType,
      reason,
      oldValue: oldValue || null,
      newValue: newValue || null,
      changedBy: session.user.id,
    },
    include: {
      changedByUser: { select: { id: true, name: true } },
    },
  });

  return success(change, 201);
});
