"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { extractItems, extractData } from "@/lib/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OvertimeType = "NONE" | "WEEKDAY" | "HOLIDAY";

export type TimeEntry = {
  id: string;
  taskId: string | null;
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
  task?: { id: string; title: string; category?: string } | null;
};

export type TaskOption = {
  id: string;
  title: string;
};

export type TaskRow = {
  taskId: string | null;
  label: string;
};

export type TimerState = {
  isRunning: boolean;
  taskId: string | null;
  taskLabel: string;
  startTime: number | null; // epoch ms
  entryId: string | null;
};

type StatsData = {
  totalHours: number;
  breakdown: { category: string; hours: number; pct: number }[];
  taskInvestmentRate: number;
  entryCount: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getMondayOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function getSundayOfWeek(monday: Date): Date {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return sunday;
}

export function formatWeekRange(monday: Date): string {
  const sunday = getSundayOfWeek(monday);
  const fmt = (d: Date) =>
    `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`;
  return `${fmt(monday)} — ${fmt(sunday)}`;
}

export function getDateStr(weekStart: Date, dayOffset: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().split("T")[0];
}

export function formatDateLabel(weekStart: Date, offset: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + offset);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const DAYS_COUNT = 7;
const DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

const FREE_ROW: TaskRow = { taskId: null, label: "自由工時（無任務）" };

const TIMER_STORAGE_KEY = "titan-timer-state";

function loadTimerState(): TimerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TimerState;
  } catch {
    return null;
  }
}

function saveTimerState(state: TimerState | null) {
  if (typeof window === "undefined") return;
  if (state) {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(TIMER_STORAGE_KEY);
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTimesheet(userFilter?: string) {
  // Week navigation
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()));

  // Data
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [taskRows, setTaskRows] = useState<TaskRow[]>([FREE_ROW]);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Timer
  const [timer, setTimer] = useState<TimerState | null>(() => loadTimerState());
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist timer state
  useEffect(() => {
    saveTimerState(timer);
  }, [timer]);

  // Tick timer
  useEffect(() => {
    if (timer?.isRunning && timer.startTime) {
      setElapsed(Math.floor((Date.now() - timer.startTime) / 1000));
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - timer.startTime!) / 1000));
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timer]);

  // Load tasks
  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((body) => setTasks(extractItems<TaskOption>(body)))
      .catch(() => {});
  }, []);

  // Load entries for the week
  const loadEntries = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({
        weekStart: weekStart.toISOString().split("T")[0],
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
  }, [weekStart, userFilter]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Load stats
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const sunday = getSundayOfWeek(weekStart);
      const params = new URLSearchParams({
        startDate: weekStart.toISOString().split("T")[0],
        endDate: sunday.toISOString().split("T")[0],
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
  }, [weekStart, userFilter]);

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
    existingId?: string
  ) {
    const payload = {
      taskId,
      date,
      hours,
      category,
      description,
      overtimeType,
      overtime: overtimeType !== "NONE",
    };

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

  // ─── Week Navigation ────────────────────────────────────────────────────────

  function prevWeek() {
    setWeekStart((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() - 7);
      return n;
    });
  }

  function nextWeek() {
    setWeekStart((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + 7);
      return n;
    });
  }

  function goToThisWeek() {
    setWeekStart(getMondayOfWeek(new Date()));
  }

  // ─── Copy Previous Week ─────────────────────────────────────────────────────

  async function copyPreviousWeek() {
    const prevMonday = new Date(weekStart);
    prevMonday.setDate(prevMonday.getDate() - 7);
    const res = await fetch("/api/time-entries/copy-week", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceWeekStart: prevMonday.toISOString().split("T")[0],
        targetWeekStart: weekStart.toISOString().split("T")[0],
      }),
    });
    if (res.ok) {
      await loadEntries();
      loadStats();
    }
    return res.ok;
  }

  // ─── Timer ──────────────────────────────────────────────────────────────────

  async function startTimer(taskId: string | null) {
    try {
      const res = await fetch("/api/time-entries/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: taskId || undefined }),
      });
      if (res.status === 409) return { ok: false, error: "已有計時器在運行中" };
      if (!res.ok) return { ok: false, error: "啟動計時器失敗" };
      const body = await res.json();
      const entry = extractData<{ id: string; taskId: string | null; startTime: string; task?: { title: string } | null }>(body);
      const taskLabel = entry.task?.title ?? "自由工時";
      setTimer({
        isRunning: true,
        taskId: entry.taskId,
        taskLabel,
        startTime: new Date(entry.startTime).getTime(),
        entryId: entry.id,
      });
      return { ok: true, error: null };
    } catch {
      return { ok: false, error: "啟動計時器失敗" };
    }
  }

  async function stopTimer() {
    try {
      const res = await fetch("/api/time-entries/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) return { ok: false, error: "停止計時器失敗" };
      setTimer(null);
      await loadEntries();
      loadStats();
      return { ok: true, error: null };
    } catch {
      return { ok: false, error: "停止計時器失敗" };
    }
  }

  // Restore timer from server on mount
  useEffect(() => {
    fetch("/api/time-entries/running")
      .then((r) => r.json())
      .then((body) => {
        const data = extractData<{ id: string; taskId: string | null; startTime: string; task?: { title: string } | null } | null>(body);
        if (data?.startTime) {
          setTimer({
            isRunning: true,
            taskId: data.taskId,
            taskLabel: data.task?.title ?? "自由工時",
            startTime: new Date(data.startTime).getTime(),
            entryId: data.id,
          });
        }
      })
      .catch(() => {});
  }, []);

  // ─── Computed ───────────────────────────────────────────────────────────────

  // Daily totals (7 days Mon-Sun)
  const dailyTotals = Array.from({ length: DAYS_COUNT }, (_, i) => {
    const dateStr = getDateStr(weekStart, i);
    return entries
      .filter((e) => e.date.split("T")[0] === dateStr)
      .reduce((sum, e) => sum + e.hours, 0);
  });

  const weeklyTotal = entries.reduce((sum, e) => sum + e.hours, 0);

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
    // Week
    weekStart,
    prevWeek,
    nextWeek,
    goToThisWeek,
    formatWeekRange: () => formatWeekRange(weekStart),

    // Data
    entries,
    taskRows,
    tasks,
    stats,

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

    // Timer
    timer,
    elapsed,
    startTimer,
    stopTimer,

    // Computed
    dailyTotals,
    weeklyTotal,
    getEntriesForCell,

    // Constants
    dayLabels: DAY_LABELS,
    daysCount: DAYS_COUNT,
    getDateStr: (offset: number) => getDateStr(weekStart, offset),
    formatDateLabel: (offset: number) => formatDateLabel(weekStart, offset),
  };
}
