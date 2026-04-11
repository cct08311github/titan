"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { extractItems, extractData } from "@/lib/api-client";
import { formatLocalDate } from "@/lib/utils/date";

// Re-export from extracted hooks for backward compatibility
export { getMondayOfWeek, getSundayOfWeek, formatWeekRange, getDateStr, formatDateLabel } from "./use-week-navigation";
export { type TimerState } from "./use-timer";

// Import extracted hooks
import { useTimer } from "./use-timer";
import { useWeekNavigation, getSundayOfWeek } from "./use-week-navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OvertimeType = "NONE" | "WEEKDAY" | "REST_DAY" | "HOLIDAY";

export type TimeEntry = {
  id: string;
  taskId: string | null;
  subTaskId?: string | null;              // Issue #933
  date: string;
  hours: number;
  startTime?: string | null;
  endTime?: string | null;
  isRunning?: boolean;
  overtime?: boolean;
  overtimeType?: OvertimeType;
  category: string;
  description: string | null;
  sortOrder?: number;
  locked?: boolean;
  task?: { id: string; title: string; category?: string } | null;
  subTask?: { id: string; title: string } | null;  // Issue #933
};

export type SubTaskOption = {
  id: string;
  title: string;
};

export type TaskOption = {
  id: string;
  title: string;
};

export type TaskRow = {
  taskId: string | null;
  label: string;
};

type StatsData = {
  totalHours: number;
  breakdown: { category: string; hours: number; pct: number }[];
  taskInvestmentRate: number;
  entryCount: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const FREE_ROW: TaskRow = { taskId: null, label: "自由工時（無任務）" };

// ─── Hook (facade) ───────────────────────────────────────────────────────────

export function useTimesheet(userFilter?: string) {
  // Compose extracted hooks
  const week = useWeekNavigation();
  const timerHook = useTimer();

  // Data
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [taskRows, setTaskRows] = useState<TaskRow[]>([FREE_ROW]);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);

  // Issue #933: subtask cache keyed by taskId
  const [subTasksMap, setSubTasksMap] = useState<Map<string, SubTaskOption[]>>(new Map());

  // Loading states
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Load tasks
  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((body) => setTasks(extractItems<TaskOption>(body)))
      .catch(() => { toast.warning("工時任務清單載入失敗"); });
  }, []);

  // Issue #933: fetch subtasks for a task (cached)
  const fetchSubTasks = useCallback(async (taskId: string): Promise<SubTaskOption[]> => {
    const cached = subTasksMap.get(taskId);
    if (cached) return cached;
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) return [];
      const body = await res.json();
      const task = extractData<{ subTasks?: SubTaskOption[] }>(body);
      const subs = task?.subTasks ?? [];
      setSubTasksMap((prev) => new Map(prev).set(taskId, subs));
      return subs;
    } catch {
      return [];
    }
  }, [subTasksMap]);

  // Load entries for the week
  const loadEntries = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({
        weekStart: formatLocalDate(week.weekStart),
      });
      if (userFilter) params.set("userId", userFilter);
      const res = await fetch(`/api/time-entries?${params}`);
      if (!res.ok) throw new Error("工時資料載入失敗");
      const body = await res.json();
      const data = extractItems<TimeEntry>(body);
      setEntries(data);

      // Build task rows from entries
      const seenTasks = new Map<string, string>();
      for (const e of data) {
        if (e.taskId && !seenTasks.has(e.taskId)) {
          const label = e.task?.title ?? e.taskId;
          seenTasks.set(e.taskId, label);
        }
      }
      const rows: TaskRow[] = [
        ...Array.from(seenTasks.entries()).map(([taskId, label]) => ({ taskId, label })),
        FREE_ROW,
      ];
      setTaskRows(rows);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [week.weekStart, userFilter]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Load stats
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const sunday = getSundayOfWeek(week.weekStart);
      const params = new URLSearchParams({
        startDate: formatLocalDate(week.weekStart),
        endDate: formatLocalDate(sunday),
      });
      if (userFilter) params.set("userId", userFilter);
      const res = await fetch(`/api/time-entries/stats?${params}`);
      if (res.ok) {
        const b = await res.json();
        setStats(extractData<StatsData>(b));
      }
    } finally {
      setStatsLoading(false);
    }
  }, [week.weekStart, userFilter]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  async function saveEntry(
    taskId: string | null,
    date: string,
    hours: number,
    category: string,
    description: string,
    overtimeType: OvertimeType,
    existingId?: string,
    subTaskId?: string | null,           // Issue #933
    startTime?: string | null,           // v3: start/end time
    endTime?: string | null              // v3: start/end time
  ) {
    const payload: Record<string, unknown> = {
      taskId,
      subTaskId: subTaskId ?? null,      // Issue #933
      date,
      hours,
      category,
      description,
      overtimeType,
      overtime: overtimeType !== "NONE",
    };
    // v3: include startTime/endTime if provided
    if (startTime !== undefined) payload.startTime = startTime;
    if (endTime !== undefined) payload.endTime = endTime;

    if (existingId) {
      const res = await fetch(`/api/time-entries/${existingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const ub = await res.json();
        const updated = extractData<TimeEntry>(ub);
        setEntries((prev) => prev.map((e) => (e.id === existingId ? updated : e)));
      }
    } else {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const cb = await res.json();
        const created = extractData<TimeEntry>(cb);
        setEntries((prev) => [...prev, created]);
        // Add task row if new
        if (taskId && !taskRows.find((r) => r.taskId === taskId)) {
          const taskLabel = tasks.find((t) => t.id === taskId)?.title ?? taskId;
          setTaskRows((prev) => [
            ...prev.filter((r) => r.taskId !== null),
            { taskId, label: taskLabel },
            FREE_ROW,
          ]);
        }
      }
    }
    loadStats();
  }

  async function deleteEntry(id: string) {
    const res = await fetch(`/api/time-entries/${id}`, { method: "DELETE" });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      loadStats();
    }
  }

  // Quick save: just hours (for inline cell editing)
  async function quickSave(
    taskId: string | null,
    date: string,
    hours: number,
    existingId?: string
  ) {
    await saveEntry(taskId, date, hours, "PLANNED_TASK", "", "NONE", existingId);
  }

  // ─── Copy Previous Week ─────────────────────────────────────────────────────

  async function copyPreviousWeek(): Promise<{ ok: boolean; count: number }> {
    const prevMonday = new Date(week.weekStart);
    prevMonday.setDate(prevMonday.getDate() - 7);
    const res = await fetch("/api/time-entries/copy-week", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceWeekStart: formatLocalDate(prevMonday),
        targetWeekStart: formatLocalDate(week.weekStart),
      }),
    });
    let count = 0;
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      count = body?.data?.copied ?? 0;
      await loadEntries();
      loadStats();
    }
    return { ok: res.ok, count };
  }

  // ─── Timer wrappers (preserve original interface) ───────────────────────────

  async function startTimer(taskId: string | null) {
    return await timerHook.startTimer(taskId);
  }

  async function stopTimer() {
    const result = await timerHook.stopTimer();
    if (result.ok) {
      await loadEntries();
      loadStats();
    }
    return result;
  }

  // ─── Computed ───────────────────────────────────────────────────────────────

  // Daily totals (7 days Mon-Sun)
  const dailyTotals = Array.from({ length: week.daysCount }, (_, i) => {
    const dateStr = week.getDateStr(i);
    return entries
      .filter((e) => e.date.split("T")[0] === dateStr)
      .reduce((sum, e) => sum + Number(e.hours), 0);
  });

  const weeklyTotal = entries.reduce((sum, e) => sum + Number(e.hours), 0);

  // Get entries for a specific cell
  function getEntriesForCell(taskId: string | null, dateStr: string): TimeEntry[] {
    return entries.filter(
      (e) => (e.taskId ?? null) === (taskId ?? null) && e.date.split("T")[0] === dateStr
    );
  }

  // Add a new empty task row
  function addTaskRow(taskId: string, label: string) {
    if (taskRows.find((r) => r.taskId === taskId)) return;
    setTaskRows((prev) => [
      ...prev.filter((r) => r.taskId !== null),
      { taskId, label },
      FREE_ROW,
    ]);
  }

  return {
    // Week (from useWeekNavigation)
    weekStart: week.weekStart,
    prevWeek: week.goToPrevWeek,
    nextWeek: week.goToNextWeek,
    goToThisWeek: week.goToToday,
    formatWeekRange: week.formatWeekRange,

    // Data
    entries,
    taskRows,
    tasks,
    stats,
    subTasksMap,                           // Issue #933
    fetchSubTasks,                         // Issue #933

    // Loading
    loading,
    loadError,
    statsLoading,
    refresh: loadEntries,

    // CRUD
    saveEntry,
    deleteEntry,
    quickSave,
    copyPreviousWeek,

    // Task rows
    addTaskRow,

    // Timer (from useTimer)
    timer: timerHook.timer,
    elapsed: timerHook.elapsed,
    startTimer,
    stopTimer,

    // Computed
    dailyTotals,
    weeklyTotal,
    getEntriesForCell,

    // Constants (from useWeekNavigation)
    dayLabels: week.dayLabels,
    daysCount: week.daysCount,
    getDateStr: week.getDateStr,
    formatDateLabel: week.formatDateLabel,
  };
}
