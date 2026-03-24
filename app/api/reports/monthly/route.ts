import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get("month"); // format: "2026-03"
    const now = new Date();
    const year = monthParam
      ? parseInt(monthParam.split("-")[0])
      : now.getFullYear();
    const month = monthParam
      ? parseInt(monthParam.split("-")[1])
      : now.getMonth() + 1;

    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const isManager = session.user.role === "MANAGER";
    const userFilter = isManager ? {} : { primaryAssigneeId: session.user.id };

    const allTasks = await prisma.task.findMany({
      where: {
        ...userFilter,
        createdAt: { lte: monthEnd },
        OR: [
          { dueDate: { gte: monthStart, lte: monthEnd } },
          { status: "DONE", updatedAt: { gte: monthStart, lte: monthEnd } },
          { status: { notIn: ["DONE"] }, dueDate: null },
        ],
      },
      include: {
        primaryAssignee: { select: { id: true, name: true } },
        monthlyGoal: { select: { id: true, title: true, month: true } },
      },
    });

    const completedTasks = allTasks.filter((t) => t.status === "DONE");
    const completionRate =
      allTasks.length > 0
        ? Math.round((completedTasks.length / allTasks.length) * 100)
        : 0;

    const timeEntryFilter = isManager
      ? { date: { gte: monthStart, lte: monthEnd } }
      : { userId: session.user.id, date: { gte: monthStart, lte: monthEnd } };

    const timeEntries = await prisma.timeEntry.findMany({
      where: timeEntryFilter,
      include: { user: { select: { id: true, name: true } } },
    });

    const totalHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);
    const hoursByCategory = timeEntries.reduce(
      (acc, e) => {
        acc[e.category] = (acc[e.category] ?? 0) + e.hours;
        return acc;
      },
      {} as Record<string, number>
    );

    const monthlyGoals = await prisma.monthlyGoal.findMany({
      where: {
        month,
        annualPlan: { year },
      },
      include: {
        tasks: {
          where: userFilter,
          select: { id: true, status: true, progressPct: true },
        },
      },
    });

    const changes = await prisma.taskChange.findMany({
      where: { changedAt: { gte: monthStart, lte: monthEnd } },
      include: {
        task: { select: { id: true, title: true } },
        changedByUser: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      period: { year, month, start: monthStart, end: monthEnd },
      totalTasks: allTasks.length,
      completedTasks: completedTasks.length,
      completionRate,
      totalHours,
      hoursByCategory,
      monthlyGoals,
      changes,
      delayCount: changes.filter((c) => c.changeType === "DELAY").length,
      scopeChangeCount: changes.filter((c) => c.changeType === "SCOPE_CHANGE")
        .length,
    });
  } catch (error) {
    console.error("GET /api/reports/monthly error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
