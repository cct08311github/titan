import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) return NextResponse.json({ error: "未授權" }, { status: 401 });

    const { id } = await params;
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

    return NextResponse.json(subtask);
  } catch (error) {
    console.error("PATCH /api/subtasks/[id] error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) return NextResponse.json({ error: "未授權" }, { status: 401 });

    const { id } = await params;
    await prisma.subTask.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/subtasks/[id] error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
