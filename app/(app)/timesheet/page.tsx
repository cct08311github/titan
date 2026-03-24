"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { TimesheetGrid, type TaskRow } from "@/app/components/timesheet-grid";
import { TimeSummary } from "@/app/components/time-summary";
import { type TimeEntry } from "@/app/components/time-entry-cell";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";

// ─── Types ────────────────────────────────────────────────────────────────────

type User = { id: string; name: string };

type StatsData = {
  totalHours: number;
  breakdown: { category: string; hours: number; pct: number }[];
  taskInvestmentRate: number;
  entryCount: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMondayOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatWeekLabel(monday: Date): string {
  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);
  const fmt = (d: Date) =>
    `${d.getMonth() + 1}/${d.getDate()}`;
  return `${monday.getFullYear()} 年　${fmt(monday)} — ${fmt(friday)}`;
}

// Fixed task rows: include a "自由工時" row for entries without a task
const FREE_ROW: TaskRow = { taskId: null, label: "自由工時（無任務）" };

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TimesheetPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()));
  const [userFilter, setUserFilter] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [taskRows, setTaskRows] = useState<TaskRow[]>([FREE_ROW]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Load users
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
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
      const data: (TimeEntry & { task?: { id: string; title: string } | null })[] =
        await res.json();
      setEntries(data);

      // Build task rows from entries + a free row
      const seenTasks = new Map<string, string>();
      for (const e of data) {
        if (e.taskId && !seenTasks.has(e.taskId)) {
          const label = (e as { task?: { title: string } | null }).task?.title ?? e.taskId;
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

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // Load stats for the week
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const friday = new Date(weekStart);
      friday.setDate(friday.getDate() + 4);
      const params = new URLSearchParams({
        startDate: weekStart.toISOString().split("T")[0],
        endDate: friday.toISOString().split("T")[0],
      });
      if (userFilter) params.set("userId", userFilter);
      const res = await fetch(`/api/time-entries/stats?${params}`);
      if (res.ok) setStats(await res.json());
    } finally {
      setStatsLoading(false);
    }
  }, [weekStart, userFilter]);

  useEffect(() => { loadStats(); }, [loadStats]);

  // Cell operations
  async function handleCellSave(
    taskId: string | null,
    date: string,
    hours: number,
    category: string,
    description: string,
    existingId?: string
  ) {
    if (existingId) {
      const res = await fetch(`/api/time-entries/${existingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, hours, category, description }),
      });
      if (res.ok) {
        const updated: TimeEntry = await res.json();
        setEntries((prev) => prev.map((e) => e.id === existingId ? updated : e));
      }
    } else {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, date, hours, category, description }),
      });
      if (res.ok) {
        const created: TimeEntry = await res.json();
        setEntries((prev) => [...prev, created]);
        // Add task row if new task
        if (taskId && !taskRows.find((r) => r.taskId === taskId)) {
          setTaskRows((prev) => [
            ...prev.filter((r) => r.taskId !== null),
            { taskId, label: taskId },
            FREE_ROW,
          ]);
        }
      }
    }
    // Refresh stats
    loadStats();
  }

  async function handleCellDelete(id: string) {
    const res = await fetch(`/api/time-entries/${id}`, { method: "DELETE" });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      loadStats();
    }
  }

  function prevWeek() {
    setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  }
  function nextWeek() {
    setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  }
  function thisWeek() {
    setWeekStart(getMondayOfWeek(new Date()));
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">工時紀錄</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{formatWeekLabel(weekStart)}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* User filter */}
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          >
            <option value="">我的工時</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>

          {/* Week navigation */}
          <div className="flex items-center gap-1 bg-background border border-border rounded-md">
            <button onClick={prevWeek} className="p-1.5 hover:bg-accent rounded-l-md transition-colors">
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={thisWeek}
              className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              本週
            </button>
            <button onClick={nextWeek} className="p-1.5 hover:bg-accent rounded-r-md transition-colors">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <button
            onClick={loadEntries}
            disabled={loading}
            className="p-1.5 rounded-md bg-background border border-border hover:bg-accent transition-colors"
          >
            <RefreshCw className={cn("h-4 w-4 text-muted-foreground", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-auto">
        {/* Stats summary */}
        {statsLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            計算中...
          </div>
        ) : stats && stats.totalHours > 0 ? (
          <TimeSummary
            totalHours={stats.totalHours}
            breakdown={stats.breakdown}
            taskInvestmentRate={stats.taskInvestmentRate}
          />
        ) : null}

        {/* Grid */}
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          {loading ? (
            <PageLoading message="載入工時..." className="py-12" />
          ) : loadError ? (
            <PageError message={loadError} onRetry={loadEntries} className="py-12" />
          ) : entries.length === 0 ? (
            <PageEmpty
              icon={<Clock className="h-8 w-8" />}
              title="本週尚無工時記錄"
              description="點擊格子可輸入工時"
              className="py-10"
            />
          ) : (
            <TimesheetGrid
              weekStart={weekStart}
              taskRows={taskRows}
              entries={entries}
              onCellSave={handleCellSave}
              onCellDelete={handleCellDelete}
            />
          )}
        </div>

        {/* Help */}
        <div className="text-xs text-muted-foreground/60 pb-2">
          點擊格子可輸入工時與分類。綠色 = 正常，橘色 = 超時（&gt;8h）。
        </div>
      </div>
    </div>
  );
}
