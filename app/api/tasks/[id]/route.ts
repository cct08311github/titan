import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

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
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        primaryAssignee: { select: { id: true, name: true, avatar: true, email: true } },
        backupAssignee: { select: { id: true, name: true, avatar: true, email: true } },
        creator: { select: { id: true, name: true } },
        monthlyGoal: {
          select: {
            id: true,
            title: true,
            month: true,
            annualPlan: { select: { id: true, title: true, year: true } },
          },
        },
        subTasks: { orderBy: { order: "asc" } },
        comments: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: "asc" },
        },
        deliverables: true,
        taskChanges: {
          include: { changedByUser: { select: { id: true, name: true } } },
          orderBy: { changedAt: "desc" },
        },
        kpiLinks: {
          include: { kpi: { select: { id: true, code: true, title: true } } },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "任務不存在" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
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
      progressPct,
    } = body;

    // Check if due date changed for TaskChange tracking
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "任務不存在" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (priority !== undefined) updates.priority = priority;
    if (category !== undefined) updates.category = category;
    if (primaryAssigneeId !== undefined) updates.primaryAssigneeId = primaryAssigneeId || null;
    if (backupAssigneeId !== undefined) updates.backupAssigneeId = backupAssigneeId || null;
    if (monthlyGoalId !== undefined) updates.monthlyGoalId = monthlyGoalId || null;
    if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
    if (startDate !== undefined) updates.startDate = startDate ? new Date(startDate) : null;
    if (estimatedHours !== undefined) updates.estimatedHours = estimatedHours ? parseFloat(estimatedHours) : null;
    if (tags !== undefined) updates.tags = tags;
    if (addedReason !== undefined) updates.addedReason = addedReason;
    if (addedSource !== undefined) updates.addedSource = addedSource;
    if (progressPct !== undefined) updates.progressPct = progressPct;

    const task = await prisma.task.update({
      where: { id },
      data: updates,
      include: {
        primaryAssignee: { select: { id: true, name: true, avatar: true } },
        backupAssignee: { select: { id: true, name: true, avatar: true } },
        subTasks: true,
        deliverables: true,
      },
    });

    // Track due date changes
    if (dueDate !== undefined && existing.dueDate?.toISOString() !== (dueDate ? new Date(dueDate).toISOString() : null)) {
      await prisma.taskChange.create({
        data: {
          taskId: id,
          changeType: "DELAY",
          reason: body.changeReason ?? "截止日變更",
          oldValue: existing.dueDate?.toISOString() ?? null,
          newValue: dueDate ?? null,
          changedBy: session.user.id,
        },
      });
    }

    return NextResponse.json(task);
  } catch (error) {
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
    await prisma.task.delete({ where: { id } });
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
    const { status } = await req.json();

    if (!status) {
      return NextResponse.json({ error: "status 為必填" }, { status: 400 });
    }

    const task = await prisma.task.update({
      where: { id },
      data: { status },
      include: {
        primaryAssignee: { select: { id: true, name: true, avatar: true } },
        backupAssignee: { select: { id: true, name: true, avatar: true } },
      },
    });

    await prisma.taskActivity.create({
      data: {
        taskId: id,
        userId: session.user.id,
        action: "STATUS_CHANGED",
        detail: { status },
      },
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("PATCH /api/tasks/[id] error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
