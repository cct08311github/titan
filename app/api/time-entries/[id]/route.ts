import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { TimeCategory } from "@prisma/client";
import { ValidationError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { updateTimeEntrySchema } from "@/validators/time-entry-validators";

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
    const raw = await req.json();
    const { taskId, date, hours, category, description } = validateBody(
      updateTimeEntrySchema,
      raw
    );

    const updates: Record<string, unknown> = {};
    if (taskId !== undefined) updates.taskId = taskId || null;
    if (date !== undefined) updates.date = new Date(date);
    if (hours !== undefined) updates.hours = hours;
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
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
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
