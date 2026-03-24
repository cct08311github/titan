import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/services/errors";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";

export const PATCH = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();

  const { id } = await context.params;
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
