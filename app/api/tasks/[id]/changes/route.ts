import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const changes = await prisma.taskChange.findMany({
      where: { taskId: params.id },
      include: {
        changedByUser: { select: { id: true, name: true } },
      },
      orderBy: { changedAt: "desc" },
    });

    return NextResponse.json(changes);
  } catch (error) {
    console.error("GET /api/tasks/[id]/changes error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const body = await req.json();
    const { changeType, reason, oldValue, newValue } = body;

    if (!changeType || !reason) {
      return NextResponse.json(
        { error: "changeType 和 reason 為必填" },
        { status: 400 }
      );
    }

    const change = await prisma.taskChange.create({
      data: {
        taskId: params.id,
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

    return NextResponse.json(change, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks/[id]/changes error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
