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
    const dateParam = searchParams.get("date");
    const refDate = dateParam ? new Date(dateParam) : new Date();

    // Week bounds: Monday–Sunday
    const day = refDate.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(refDate);
    weekStart.setDate(refDate.getDate() + diffToMon);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const isManager = session.user.role === "MANAGER";
    const userFilter = isManager ? {} : { primaryAssigneeId: session.user.id };

    const completedTasks = await prisma.task.findMany({
      where: {
        ...userFilter,
        status: "DONE",
        updatedAt: { gte: weekStart, lte: weekEnd },
      },
      include: {
        primaryAssignee: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const timeEntryFilter = isManager
      ? { date: { gte: weekStart, lte: weekEnd } }
      : { userId: session.user.id, date: { gte: weekStart, lte: weekEnd } };

    const timeEntries = await prisma.timeEntry.findMany({
      where: timeEntryFilter,
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    const totalHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);
    const hoursByCategory = timeEntries.reduce(
      (acc, e) => {
        acc[e.category] = (acc[e.category] ?? 0) + e.hours;
        return acc;
      },
      {} as Record<string, number>
    );

    const overdueTasks = await prisma.task.findMany({
      where: {
        ...userFilter,
        status: { notIn: ["DONE"] },
        dueDate: { lt: new Date() },
      },
      include: {
        primaryAssignee: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    });

    const changes = await prisma.taskChange.findMany({
      where: { changedAt: { gte: weekStart, lte: weekEnd } },
      include: {
        task: { select: { id: true, title: true } },
        changedByUser: { select: { id: true, name: true } },
      },
      orderBy: { changedAt: "desc" },
    });

    return NextResponse.json({
      period: { start: weekStart, end: weekEnd },
      completedTasks,
      completedCount: completedTasks.length,
      totalHours,
      hoursByCategory,
      overdueTasks,
      overdueCount: overdueTasks.length,
      changes,
      delayCount: changes.filter((c) => c.changeType === "DELAY").length,
      scopeChangeCount: changes.filter((c) => c.changeType === "SCOPE_CHANGE")
        .length,
    });
  } catch (error) {
    console.error("GET /api/reports/weekly error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
