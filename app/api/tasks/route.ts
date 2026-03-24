import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { TaskStatus, Priority, TaskCategory } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const assignee = searchParams.get("assignee");
    const status = searchParams.get("status") as TaskStatus | null;
    const priority = searchParams.get("priority") as Priority | null;
    const category = searchParams.get("category") as TaskCategory | null;
    const monthlyGoalId = searchParams.get("monthlyGoalId");

    const where: Record<string, unknown> = {};
    if (assignee) {
      where.OR = [
        { primaryAssigneeId: assignee },
        { backupAssigneeId: assignee },
      ];
    }
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (monthlyGoalId) where.monthlyGoalId = monthlyGoalId;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        primaryAssignee: { select: { id: true, name: true, avatar: true } },
        backupAssignee: { select: { id: true, name: true, avatar: true } },
        creator: { select: { id: true, name: true } },
        monthlyGoal: { select: { id: true, title: true, month: true } },
        subTasks: { orderBy: { order: "asc" } },
        deliverables: true,
        _count: { select: { subTasks: true, comments: true } },
      },
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
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
    const {
      title,
      description,
      status,
      priority,
      category,
      primaryAssigneeId,
      backupAssigneeId,
      monthlyGoalId,
      dueDate,
      startDate,
      estimatedHours,
      tags,
      addedReason,
      addedSource,
    } = body;

    if (!title) {
      return NextResponse.json({ error: "標題為必填" }, { status: 400 });
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        status: status ?? "BACKLOG",
        priority: priority ?? "P2",
        category: category ?? "PLANNED",
        primaryAssigneeId: primaryAssigneeId || null,
        backupAssigneeId: backupAssigneeId || null,
        creatorId: session.user.id,
        monthlyGoalId: monthlyGoalId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        startDate: startDate ? new Date(startDate) : null,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
        tags: tags ?? [],
        addedDate:
          category === "ADDED" || category === "INCIDENT" ? new Date() : null,
        addedReason: addedReason || null,
        addedSource: addedSource || null,
      },
      include: {
        primaryAssignee: { select: { id: true, name: true, avatar: true } },
        backupAssignee: { select: { id: true, name: true, avatar: true } },
        creator: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
