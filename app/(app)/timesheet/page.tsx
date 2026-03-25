"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Grid3X3, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractItems, extractData } from "@/lib/api-client";
import { TimesheetGrid, type TaskRow } from "@/app/components/timesheet-grid";
import { TimesheetListView } from "@/app/components/timesheet-list-view";
import { TimeSummary } from "@/app/components/time-summary";
import { TimerWidget } from "@/app/components/timer-widget";
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

type ViewMode = "grid" | "list";

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
  const { data: session } = useSession();
  const isManager = session?.user?.role === "MANAGER";
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOfWeek(new Date()));
  const [userFilter, setUserFilter] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [taskRows, setTaskRows] = useState<TaskRow[]>([FREE_ROW]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [tasks, setTasks] = useState<{ id: string; title: string }[]>([]);

  // Load users
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((body) => setUsers(extractItems<User>(body)))
      .catch(() => {});
  }, []);

  // Load tasks for timer widget task selector
  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((body) => {
        const items = extractItems<{ id: string; title: string }>(body);
        setTasks(items);
      })
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
      const data = extractItems<TimeEntry & { task?: { id: string; title: string } | null }>(body);
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
      if (res.ok) { const b = await res.json(); setStats(extractData<StatsData>(b)); }
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
        const ub = await res.json(); const updated = extractData<TimeEntry>(ub);
        setEntries((prev) => prev.map((e) => e.id === existingId ? updated : e));
      }
    } else {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, date, hours, category, description }),
      });
      if (res.ok) {
        const cb = await res.json(); const created = extractData<TimeEntry>(cb);
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

  function handleTimerChange() {
    loadEntries();
    loadStats();
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
      {/* Header — stacks vertically on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">工時紀錄</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">{formatWeekLabel(weekStart)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* User filter — only visible to MANAGER */}
          {isManager && (
            <select
              aria-label="篩選使用者"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer flex-1 sm:flex-none min-w-0"
            >
              <option value="">我的工時</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}

          {/* View toggle — grid / list */}
          <div className="flex items-center bg-background border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors",
                viewMode === "grid"
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <Grid3X3 className="h-3.5 w-3.5" />
              格子
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors",
                viewMode === "list"
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <List className="h-3.5 w-3.5" />
              列表
            </button>
          </div>

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
        {/* Timer widget + Stats summary — side by side on desktop */}
        <div className="flex flex-col sm:flex-row gap-4">
          <TimerWidget tasks={tasks} onTimerChange={handleTimerChange} />
          <div className="flex-1">
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
          </div>
        </div>

        {/* Grid or List view — horizontally scrollable on mobile */}
        <div className="border border-border rounded-xl overflow-x-auto bg-card">
          {loading ? (
            <PageLoading message="載入工時..." className="py-12" />
          ) : loadError ? (
            <PageError message={loadError} onRetry={loadEntries} className="py-12" />
          ) : viewMode === "grid" ? (
            <>
              {entries.length === 0 && (
                <div className="text-center py-3 text-xs text-muted-foreground border-b border-border">
                  點擊格子可輸入工時與分類。綠色 = 正常，橘色 = 超時（&gt;8h）。
                </div>
              )}
              <TimesheetGrid
                weekStart={weekStart}
                taskRows={taskRows}
                entries={entries}
                onCellSave={handleCellSave}
                onCellDelete={handleCellDelete}
              />
            </>
          ) : (
            <TimesheetListView
              entries={entries}
              onDelete={handleCellDelete}
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
