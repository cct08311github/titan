/**
 * My Day Aggregation API — Issue #959
 *
 * GET /api/my-day?role=ENGINEER|MANAGER
 *
 * Engineer view: flagged tasks, due today, in progress, time suggestions
 * Manager view: team health snapshot, flagged items, member workload, alerts
 *
 * Returns a unified payload for the My Day homepage.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";

export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const userId = session.user.id;
  const role = session.user.role;
  const isManager = role === "MANAGER" || role === "ADMIN";

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  if (isManager) {
    // ── Manager View ──────────────────────────────────────────────────
    const [flaggedTasks, overdueTasks, teamMembers, todayTimeEntries, plans] =
      await Promise.all([
        // Flagged tasks across team
        prisma.task.findMany({
          where: { managerFlagged: true, status: { not: "DONE" } },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            flagReason: true,
            flaggedAt: true,
            managerFlagged: true,
            primaryAssignee: { select: { id: true, name: true, avatar: true } },
          },
          orderBy: { flaggedAt: "desc" },
          take: 10,
        }),
        // Overdue tasks
        prisma.task.findMany({
          where: {
            status: { not: "DONE" },
            dueDate: { lt: now },
          },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            managerFlagged: true,
            primaryAssignee: { select: { id: true, name: true } },
          },
          orderBy: { dueDate: "asc" },
          take: 20,
        }),
        // Team members with active task counts
        prisma.user.findMany({
          where: { isActive: true, role: "ENGINEER" },
          select: {
            id: true,
            name: true,
            avatar: true,
            primaryTasks: {
              where: { status: { in: ["TODO", "IN_PROGRESS"] } },
              select: { id: true, status: true, dueDate: true, managerFlagged: true },
            },
          },
        }),
        // Today's time entries summary
        prisma.timeEntry.aggregate({
          where: {
            date: { gte: todayStart, lt: todayEnd },
          },
          _sum: { hours: true },
          _count: true,
        }),
        // Active plans for health snapshot
        prisma.annualPlan.findMany({
          where: { year: now.getFullYear(), archivedAt: null },
          select: {
            id: true,
            title: true,
            progressPct: true,
            monthlyGoals: {
              select: {
                id: true,
                title: true,
                month: true,
                progressPct: true,
                tasks: {
                  where: { status: { not: "DONE" } },
                  select: { id: true, managerFlagged: true },
                },
              },
            },
          },
        }),
      ]);

    // Build member workload
    const memberWorkload = teamMembers.map((m) => {
      const overdue = m.primaryTasks.filter(
        (t) => t.dueDate && new Date(t.dueDate) < now
      ).length;
      const flagged = m.primaryTasks.filter((t) => t.managerFlagged).length;
      return {
        id: m.id,
        name: m.name,
        avatar: m.avatar,
        activeTasks: m.primaryTasks.length,
        overdueTasks: overdue,
        flaggedTasks: flagged,
      };
    });

    // Alerts
    const alerts: { type: string; message: string }[] = [];
    if (overdueTasks.length > 0) {
      alerts.push({
        type: "WARNING",
        message: `${overdueTasks.length} 個任務已逾期`,
      });
    }
    for (const plan of plans) {
      const currentMonth = now.getMonth() + 1;
      for (const goal of plan.monthlyGoals) {
        if (goal.month === currentMonth && goal.progressPct < 50) {
          alerts.push({
            type: "CRITICAL",
            message: `「${goal.title}」本月目標進度僅 ${Math.round(goal.progressPct)}%`,
          });
        }
      }
    }

    // Plan flagged counts
    const planSummaries = plans.map((p) => {
      const flaggedCount = p.monthlyGoals.reduce(
        (sum, g) => sum + g.tasks.filter((t) => t.managerFlagged).length,
        0
      );
      return {
        id: p.id,
        title: p.title,
        progressPct: p.progressPct,
        flaggedCount,
      };
    });

    return success({
      role: "MANAGER",
      flaggedTasks,
      overdueTasks,
      memberWorkload,
      todayHours: todayTimeEntries._sum.hours ?? 0,
      alerts,
      planSummaries,
    });
  }

  // ── Engineer View ──────────────────────────────────────────────────
  const [flaggedTasks, dueTodayTasks, inProgressTasks, todayHours, monthlyGoals] =
    await Promise.all([
      // Flagged tasks for this engineer
      prisma.task.findMany({
        where: {
          managerFlagged: true,
          status: { not: "DONE" },
          OR: [{ primaryAssigneeId: userId }, { backupAssigneeId: userId }],
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          flagReason: true,
          flaggedAt: true,
          managerFlagged: true,
        },
        orderBy: { flaggedAt: "desc" },
      }),
      // Due today
      prisma.task.findMany({
        where: {
          status: { not: "DONE" },
          dueDate: { gte: todayStart, lt: todayEnd },
          OR: [{ primaryAssigneeId: userId }, { backupAssigneeId: userId }],
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          estimatedHours: true,
          managerFlagged: true,
        },
        orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
      }),
      // In progress
      prisma.task.findMany({
        where: {
          status: "IN_PROGRESS",
          OR: [{ primaryAssigneeId: userId }, { backupAssigneeId: userId }],
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          estimatedHours: true,
          actualHours: true,
          managerFlagged: true,
        },
        orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
      }),
      // Today's logged hours
      prisma.timeEntry.aggregate({
        where: {
          userId,
          date: { gte: todayStart, lt: todayEnd },
        },
        _sum: { hours: true },
      }),
      // Current month goals
      prisma.monthlyGoal.findMany({
        where: {
          annualPlan: { year: now.getFullYear(), archivedAt: null },
          month: now.getMonth() + 1,
        },
        select: {
          id: true,
          title: true,
          progressPct: true,
          status: true,
        },
      }),
    ]);

  // Time suggestions: tasks with estimated hours that haven't been started
  const timeSuggestions = dueTodayTasks
    .filter((t) => t.estimatedHours && t.status === "TODO")
    .map((t) => ({
      taskId: t.id,
      title: t.title,
      estimatedHours: t.estimatedHours,
      suggestion: `建議分配 ${t.estimatedHours}h 給「${t.title}」`,
    }));

  return success({
    role: "ENGINEER",
    flaggedTasks,
    dueTodayTasks,
    inProgressTasks,
    todayHours: todayHours._sum.hours ?? 0,
    dailyTarget: 8,
    timeSuggestions,
    monthlyGoals,
  });
});
