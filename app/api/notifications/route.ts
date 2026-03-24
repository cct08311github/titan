import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";

export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") ?? "20");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, isRead: false },
  });

  return success({ notifications, unreadCount });
});
