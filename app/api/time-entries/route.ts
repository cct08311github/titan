import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { TimeCategory } from "@prisma/client";
import { ValidationError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { createTimeEntrySchema } from "@/validators/time-entry-validators";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || session.user.id;
    const weekStart = searchParams.get("weekStart");

    const where: Record<string, unknown> = { userId };

    if (weekStart) {
      const start = new Date(weekStart);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      where.date = { gte: start, lte: end };
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        task: { select: { id: true, title: true, category: true } },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error("GET /api/time-entries error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const raw = await req.json();
    const { taskId, date, hours, category, description } = validateBody(
      createTimeEntrySchema,
      raw
    );

    const entry = await prisma.timeEntry.create({
      data: {
        taskId: taskId || null,
        userId: session.user.id,
        date: new Date(date),
        hours,
        category: (category as TimeCategory) ?? "PLANNED_TASK",
        description: description || null,
      },
      include: {
        task: { select: { id: true, title: true, category: true } },
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/time-entries error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
