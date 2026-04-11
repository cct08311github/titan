/**
 * GET /api/time-entries/suggestions — Issue #963
 *
 * Analyze today's task status changes and suggest time entries.
 * - When task moved to IN_PROGRESS → suggest timer start
 * - When task moved to DONE → suggest time entry (duration = time in IN_PROGRESS)
 *
 * Query params:
 *   date — ISO date string (defaults to today)
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";

export interface TimeSuggestion {
  id: string;
  taskId: string;
  taskTitle: string;
  type: "timer_start" | "time_entry";
  suggestedHours: number;
  date: string;
  startedAt: string | null;
  completedAt: string | null;
  category: string;
  alreadyLogged: boolean;
}

export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const targetDate = dateParam ? new Date(dateParam) : new Date();

  // Normalize to start/end of day
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  // 1. Find task activities for today (status changes)
  const activities = await prisma.taskActivity.findMany({
    where: {
      userId,
      createdAt: { gte: dayStart, lte: dayEnd },
      action: "STATUS_CHANGE",
    },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          category: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // 2. Find existing time entries for today to avoid duplicate suggestions
  const existingEntries = await prisma.timeEntry.findMany({
    where: {
      userId,
      date: { gte: dayStart, lte: dayEnd },
    },
    select: { taskId: true, hours: true },
  });

  const loggedTaskIds = new Set(existingEntries.map((e) => e.taskId).filter(Boolean));
  const loggedHoursByTask = new Map<string, number>();
  for (const entry of existingEntries) {
    if (entry.taskId) {
      loggedHoursByTask.set(
        entry.taskId,
        (loggedHoursByTask.get(entry.taskId) ?? 0) + Number(entry.hours)
      );
    }
  }

  // 3. Build suggestions from status changes
  // Process DONE first (higher priority — includes time entry suggestion),
  // then IN_PROGRESS for tasks not yet completed today.
  const suggestions: TimeSuggestion[] = [];
  const processedTasks = new Set<string>();

  // Pass 1: DONE activities → time entry suggestions
  for (const activity of activities) {
    if (!activity.task) continue;
    const detail = activity.detail as { from?: string; to?: string } | null;
    if (!detail || detail.to !== "DONE") continue;

    const taskId = activity.task.id;
    if (processedTasks.has(taskId)) continue;
    processedTasks.add(taskId);

    // Find when it was moved to IN_PROGRESS (look for earlier activity)
    const startActivity = activities.find(
      (a) =>
        a.task?.id === taskId &&
        (a.detail as { to?: string } | null)?.to === "IN_PROGRESS"
    );

    let suggestedHours = 1; // Default 1h if no start time found
    if (startActivity) {
      const diffMs =
        activity.createdAt.getTime() - startActivity.createdAt.getTime();
      suggestedHours = Math.max(0.25, Math.round((diffMs / 3600000) * 4) / 4); // Round to 0.25h
    }

    // Subtract already logged hours
    const logged = loggedHoursByTask.get(taskId) ?? 0;
    const remaining = Math.max(0, suggestedHours - logged);

    suggestions.push({
      id: `suggest-entry-${taskId}`,
      taskId,
      taskTitle: activity.task.title,
      type: "time_entry",
      suggestedHours: remaining,
      date: dayStart.toISOString().split("T")[0],
      startedAt: startActivity?.createdAt.toISOString() ?? null,
      completedAt: activity.createdAt.toISOString(),
      category: mapCategory(activity.task.category),
      alreadyLogged: loggedTaskIds.has(taskId) && remaining <= 0,
    });
  }

  // Pass 2: IN_PROGRESS activities → timer start suggestions (only if not already DONE)
  for (const activity of activities) {
    if (!activity.task) continue;
    const detail = activity.detail as { from?: string; to?: string } | null;
    if (!detail || detail.to !== "IN_PROGRESS") continue;

    const taskId = activity.task.id;
    if (processedTasks.has(taskId)) continue;
    processedTasks.add(taskId);

    suggestions.push({
      id: `suggest-start-${taskId}`,
      taskId,
      taskTitle: activity.task.title,
      type: "timer_start",
      suggestedHours: 0,
      date: dayStart.toISOString().split("T")[0],
      startedAt: activity.createdAt.toISOString(),
      completedAt: null,
      category: mapCategory(activity.task.category),
      alreadyLogged: loggedTaskIds.has(taskId),
    });
  }

  return success(suggestions);
});

function mapCategory(taskCategory: string): string {
  const map: Record<string, string> = {
    PLANNED: "PLANNED_TASK",
    ADDED: "ADDED_TASK",
    INCIDENT: "INCIDENT",
    SUPPORT: "SUPPORT",
    ADMIN: "ADMIN",
    LEARNING: "LEARNING",
  };
  return map[taskCategory] ?? "PLANNED_TASK";
}
