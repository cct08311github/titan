"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import {
  useTimesheet,
  TimesheetGrid,
  TimesheetToolbar,
  TimesheetTimer,
  type ViewMode,
} from "@/app/components/timesheet";
import { TimesheetListView } from "@/app/components/timesheet-list-view";
import { TimeSummary } from "@/app/components/time-summary";
import { PageLoading, PageError } from "@/app/components/page-states";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TimesheetPage() {
  const { data: session } = useSession();
  const isManager = session?.user?.role === "MANAGER";
  const [userFilter, setUserFilter] = useState("");
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) return "list";
    return "grid";
  });

  const ts = useTimesheet(userFilter || undefined);

  // Load users for manager filter
  useEffect(() => {
    if (!isManager) return;
    fetch("/api/users")
      .then((r) => r.json())
      .then((body) => {
        const items = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
        setUsers(items);
      })
      .catch(() => {});
  }, [isManager]);

  // Auto-switch to list on mobile resize
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 768 && viewMode === "grid") {
        setViewMode("list");
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [viewMode]);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Timer — sticky on top */}
      <TimesheetTimer
        timer={ts.timer}
        elapsed={ts.elapsed}
        tasks={ts.tasks}
        onStart={ts.startTimer}
        onStop={ts.stopTimer}
      />

      {/* Toolbar */}
      <TimesheetToolbar
        weekRange={ts.formatWeekRange()}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onPrevWeek={ts.prevWeek}
        onNextWeek={ts.nextWeek}
        onThisWeek={ts.goToThisWeek}
        onCopyPreviousWeek={ts.copyPreviousWeek}
        onRefresh={ts.refresh}
        loading={ts.loading}
        weekStart={ts.weekStart}
        entries={ts.entries}
        daysCount={ts.daysCount}
        getDateStr={ts.getDateStr}
      />

      {/* Manager user filter */}
      {isManager && (
        <select
          aria-label="篩選使用者"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="self-start bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
        >
          <option value="">我的工時</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      )}

      {/* Content area */}
      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Stats summary */}
        <div className="flex-shrink-0">
          {ts.statsLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              計算中...
            </div>
          ) : ts.stats && ts.stats.totalHours > 0 ? (
            <TimeSummary
              totalHours={ts.stats.totalHours}
              breakdown={ts.stats.breakdown}
              taskInvestmentRate={ts.stats.taskInvestmentRate}
            />
          ) : null}
        </div>

        {/* Grid or List */}
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          {ts.loading ? (
            <PageLoading message="載入工時..." className="py-12" />
          ) : ts.loadError ? (
            <PageError message={ts.loadError} onRetry={ts.refresh} className="py-12" />
          ) : viewMode === "grid" ? (
            <TimesheetGrid
              weekStart={ts.weekStart}
              taskRows={ts.taskRows}
              entries={ts.entries}
              tasks={ts.tasks}
              dailyTotals={ts.dailyTotals}
              weeklyTotal={ts.weeklyTotal}
              dayLabels={ts.dayLabels}
              daysCount={ts.daysCount}
              getDateStr={ts.getDateStr}
              formatDateLabel={ts.formatDateLabel}
              getEntriesForCell={ts.getEntriesForCell}
              onQuickSave={ts.quickSave}
              onFullSave={ts.saveEntry}
              onDelete={ts.deleteEntry}
              onAddTaskRow={ts.addTaskRow}
            />
          ) : (
            <TimesheetListView
              entries={ts.entries}
              onDelete={ts.deleteEntry}
            />
          )}
        </div>

        {/* Help text */}
        <div className="text-xs text-muted-foreground/50 pb-2">
          點擊格子直接輸入數字，Enter/Tab 自動儲存。雙擊可編輯分類、備註與加班標記。
        </div>
      </div>
    </div>
  );
}
