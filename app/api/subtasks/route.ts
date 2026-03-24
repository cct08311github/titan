import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) return NextResponse.json({ error: "未授權" }, { status: 401 });

    const body = await req.json();
    const { taskId, title, assigneeId, dueDate, order } = body;

    if (!taskId || !title) {
      return NextResponse.json({ error: "taskId 和標題為必填" }, { status: 400 });
    }

    const subtask = await prisma.subTask.create({
      data: {
        taskId,
        title,
        assigneeId: assigneeId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        order: order ?? 0,
      },
    });

    return NextResponse.json(subtask, { status: 201 });
  } catch (error) {
    console.error("POST /api/subtasks error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
