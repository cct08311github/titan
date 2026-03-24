import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { TimeCategory } from "@prisma/client";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();
    const { taskId, date, hours, category, description } = body;

    const updates: Record<string, unknown> = {};
    if (taskId !== undefined) updates.taskId = taskId || null;
    if (date !== undefined) updates.date = new Date(date);
    if (hours !== undefined) updates.hours = parseFloat(hours);
    if (category !== undefined) updates.category = category as TimeCategory;
    if (description !== undefined) updates.description = description || null;

    const entry = await prisma.timeEntry.update({
      where: { id },
      data: updates,
      include: {
        task: { select: { id: true, title: true, category: true } },
      },
    });

    return NextResponse.json(entry);
  } catch (error) {
    console.error("PUT /api/time-entries/[id] error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }
    const { id } = await params;
    await prisma.timeEntry.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/time-entries/[id] error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
