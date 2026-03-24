import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { TaskStatus, Priority, TaskCategory } from "@prisma/client";
import { TaskService } from "@/services/task-service";
import { ValidationError } from "@/services/errors";

const taskService = new TaskService(prisma);

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tasks = await taskService.listTasks({
      assignee: searchParams.get("assignee") ?? undefined,
      status: (searchParams.get("status") as TaskStatus) ?? undefined,
      priority: (searchParams.get("priority") as Priority) ?? undefined,
      category: (searchParams.get("category") as TaskCategory) ?? undefined,
      monthlyGoalId: searchParams.get("monthlyGoalId") ?? undefined,
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("GET /api/tasks error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const body = await req.json();
    const task = await taskService.createTask({
      ...body,
      creatorId: session.user.id,
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/tasks error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
