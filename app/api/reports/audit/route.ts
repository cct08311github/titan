import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { ValidationError } from "@/services/errors";

export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    throw new ValidationError(
      JSON.stringify({
        error: "請提供起迄日期",
        fields: { from: !from ? ["必填"] : [], to: !to ? ["必填"] : [] },
      })
    );
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  // Time entries for the period
  const timeEntries = await prisma.timeEntry.findMany({
    where: {
      userId: session.user.id,
      date: { gte: fromDate, lte: toDate },
    },
    include: {
      task: { select: { title: true, category: true } },
    },
    orderBy: { date: "asc" },
  });

  // Tasks completed in the period
  const tasks = await prisma.task.findMany({
    where: {
      OR: [
        { primaryAssigneeId: session.user.id },
        { backupAssigneeId: session.user.id },
      ],
      updatedAt: { gte: fromDate, lte: toDate },
    },
    select: {
      title: true,
      category: true,
      status: true,
      dueDate: true,
      primaryAssignee: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Calculate summary stats
  const totalHours = timeEntries.reduce((sum, e) => sum + Number(e.hours), 0);
  const incidentHours = timeEntries
    .filter((e) => e.category === "INCIDENT")
    .reduce((sum, e) => sum + Number(e.hours), 0);
  const plannedHours = timeEntries
    .filter((e) => e.category === "PLANNED_TASK")
    .reduce((sum, e) => sum + Number(e.hours), 0);

  return success({
    period: { from, to },
    summary: {
      totalHours: Math.round(totalHours * 10) / 10,
      plannedHours: Math.round(plannedHours * 10) / 10,
      incidentHours: Math.round(incidentHours * 10) / 10,
      plannedRate: totalHours > 0 ? Math.round((plannedHours / totalHours) * 100) : 0,
      incidentRate: totalHours > 0 ? Math.round((incidentHours / totalHours) * 100) : 0,
    },
    timeEntries: timeEntries.map((e) => ({
      date: e.date,
      taskTitle: e.task?.title ?? "（無任務）",
      hours: e.hours,
      category: e.category,
      description: e.description,
    })),
    tasks: tasks.map((t) => ({
      title: t.title,
      category: t.category,
      status: t.status,
      assignee: t.primaryAssignee?.name ?? "",
      dueDate: t.dueDate,
    })),
  });
});
