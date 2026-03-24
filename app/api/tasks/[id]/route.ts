import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { TaskService } from "@/services/task-service";
import { NotFoundError, ValidationError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { updateTaskSchema, updateTaskStatusSchema } from "@/validators/task-validators";

const taskService = new TaskService(prisma);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }
    const { id } = await params;
    const task = await taskService.getTask(id);
    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "任務不存在" }, { status: 404 });
    }
    console.error("GET /api/tasks/[id] error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

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
    const body = validateBody(updateTaskSchema, raw);
    const task = await taskService.updateTask(id, body);
    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "任務不存在" }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("PUT /api/tasks/[id] error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }
    const { id } = await params;
    await taskService.deleteTask(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/tasks/[id] error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

export async function PATCH(
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
    const { status } = validateBody(updateTaskStatusSchema, raw);
    const task = await taskService.updateTaskStatus(id, status, session.user.id);
    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "任務不存在" }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("PATCH /api/tasks/[id] error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
