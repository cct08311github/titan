import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { UnauthorizedError, NotFoundError } from "@/services/errors";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";

export const PATCH = apiHandler(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const { id } = await context!.params;
  const notification = await prisma.notification.findUnique({ where: { id } });

  if (!notification || notification.userId !== session.user.id) {
    throw new NotFoundError("找不到通知");
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  return success(updated);
});
