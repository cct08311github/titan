import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const notification = await prisma.notification.findUnique({
      where: { id: params.id },
    });

    if (!notification || notification.userId !== session.user.id) {
      return NextResponse.json({ error: "找不到通知" }, { status: 404 });
    }

    const updated = await prisma.notification.update({
      where: { id: params.id },
      data: { isRead: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/notifications/[id]/read error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
