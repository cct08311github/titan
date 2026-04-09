"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CalendarDays, TableProperties, Clock } from "lucide-react";
import Link from "next/link";
import {
  useTimesheet,
  TimesheetGrid,
  TimesheetToolbar,
  TimesheetTimer,
  CalendarDayView,
  CalendarWeekView,
  CalendarMonthView,
  type ViewMode,
} from "@/app/components/timesheet";
import { TimesheetListView } from "@/app/components/timesheet-list-view";
import { TimeSummary } from "@/app/components/time-summary";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";
import { TimesheetPivotTable, type TimesheetPivotData } from "@/app/components/timesheet-pivot-table";
import { cn } from "@/lib/utils";

type SummaryTab = "timesheet" | "weekly-pivot" | "monthly-pivot";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TimesheetPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const isManager = session?.user?.role === "MANAGER";
  const [userFilter, setUserFilter] = useState("");
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());
  const [summaryTab, setSummaryTab] = useState<SummaryTab>("timesheet");
  const [pivotData, setPivotData] = useState<TimesheetPivotData | null>(null);
  const [pivotLoading, setPivotLoading] = useState(false);
  const pivotCache = useRef<Map<string, TimesheetPivotData>>(new Map());

  const ts = useTimesheet(userFilter || undefined);

  // Issue #933 + #1202: batch pre-fetch subtasks for all task rows (avoid N+1)
  useEffect(() => {
    const taskIds = ts.taskRows
      .map((row) => row.taskId)
      .filter((id): id is string => !!id && !ts.subTasksMap.has(id));
    if (taskIds.length === 0) return;
    // Batch: fetch all uncached subtasks in parallel (single Promise.all)
    Promise.all(taskIds.map((id) => ts.fetchSubTasks(id))).catch(() => { toast.error("子任務載入失敗，請重新整理"); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ts.taskRows]);

  // Fetch pivot data when tab switches (Issue #832)
  const fetchPivot = useCallback(async (tab: SummaryTab) => {
    if (tab === "timesheet") return;
    const cached = pivotCache.current.get(tab);
    if (cached) { setPivotData(cached); return; }
    setPivotLoading(true);
    try {
      const endpoint = tab === "weekly-pivot"
        ? "/api/reports/weekly?view=pivot"
        : `/api/reports/monthly?view=pivot&month=${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const body = await res.json();
        const data = body?.data ?? null;
        setPivotData(data);
        if (data) pivotCache.current.set(tab, data);
      } else {
        toast.error("報表載入失敗，請稍後再試");
      }
    } finally {
      setPivotLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPivot(summaryTab);
  }, [summaryTab, fetchPivot]);

  // Load users for manager filter
  useEffect(() => {
    if (!isManager) return;
    fetch("/api/users")
      .then((r) => r.json())
      .then((body) => {
        const items = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
        setUsers(items);
      })
      .catch(() => { toast.warning("使用者清單載入失敗"); });
  }, [isManager]);

  // Auto-switch to list on mobile (initial + resize)
  useEffect(() => {
    function checkMobile() {
      if (window.innerWidth < 768) {
        setViewMode("list");
      }
    }
    checkMobile(); // check on mount
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div className="flex flex-col gap-4">
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

      {/* Manager actions — Issue #832: added pivot tabs */}
      {isManager && (
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center bg-muted/50 rounded-lg p-0.5 gap-0.5">
            {([
              { key: "timesheet" as SummaryTab, label: "工時填報" },
              { key: "weekly-pivot" as SummaryTab, label: "週報摘要" },
              { key: "monthly-pivot" as SummaryTab, label: "月報摘要" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSummaryTab(key)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors whitespace-nowrap",
                  summaryTab === key
                    ? "bg-background text-foreground font-medium shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {key !== "timesheet" && <TableProperties className="h-3.5 w-3.5" />}
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => router.push("/timesheet/monthly")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted transition-colors"
          >
            <CalendarDays className="h-4 w-4" />
            月曆
          </button>
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
        </div>
      )}

      {/* Pivot table view (Issue #832) */}
      {summaryTab !== "timesheet" && (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-medium text-foreground">
              {summaryTab === "weekly-pivot" ? "週報" : "月報"}摘要 — 人員 × 類別 Pivot Table
            </h2>
            {pivotData && (
              <p className="text-xs text-muted-foreground mt-0.5">
                期間：{pivotData.period.label}
              </p>
            )}
          </div>
          <TimesheetPivotTable data={pivotData ?? { period: { start: "", end: "", label: "" }, rows: [], categories: [], categoryTotals: {}, grandTotal: 0, grandOvertimeTotal: 0 }} loading={pivotLoading} />
        </div>
      )}

      {/* Content area */}
      <div className={cn("flex flex-col gap-4", summaryTab !== "timesheet" && "hidden")}>
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

        {/* Grid, List, or Calendar */}
        <div className={cn(
          "border border-border rounded-xl overflow-hidden bg-card min-h-[400px]",
          (viewMode === "calendar" || viewMode === "calendar-week" || viewMode === "calendar-month") && "p-4"
        )}>
          {ts.loading ? (
            <PageLoading message="載入工時..." className="py-12" />
          ) : ts.loadError ? (
            <PageError message={ts.loadError} onRetry={ts.refresh} className="py-12" />
          ) : ts.taskRows.filter(r => r.taskId !== null).length === 0 && viewMode === "grid" ? (
            <PageEmpty
              icon={<Clock className="h-10 w-10" />}
              title="從看板選擇任務或先建立一個"
              description="工時紀錄會依照你在看板上的任務自動帶入"
              action={
                <Link
                  href="/kanban"
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-card hover:bg-accent text-foreground rounded-lg border border-border shadow-sm hover:shadow transition-all"
                >
                  前往看板
                </Link>
              }
            />
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
              subTasksMap={ts.subTasksMap}
              getDateStr={ts.getDateStr}
              formatDateLabel={ts.formatDateLabel}
              getEntriesForCell={ts.getEntriesForCell}
              onQuickSave={ts.quickSave}
              onFullSave={ts.saveEntry}
              onDelete={ts.deleteEntry}
              onAddTaskRow={ts.addTaskRow}
            />
          ) : viewMode === "calendar" ? (
            <CalendarDayView
              selectedDate={calendarDate}
              entries={ts.entries}
              tasks={ts.tasks}
              onDateChange={setCalendarDate}
              onSaveEntry={ts.saveEntry}
              onDeleteEntry={ts.deleteEntry}
            />
          ) : viewMode === "calendar-week" ? (
            <CalendarWeekView
              weekStart={ts.weekStart}
              entries={ts.entries}
              tasks={ts.tasks}
              onPrevWeek={ts.prevWeek}
              onNextWeek={ts.nextWeek}
              onThisWeek={ts.goToThisWeek}
              onSaveEntry={ts.saveEntry}
              onDeleteEntry={ts.deleteEntry}
            />
          ) : viewMode === "calendar-month" ? (
            <CalendarMonthView
              onDayClick={(date) => {
                setCalendarDate(date);
                setViewMode("calendar");
              }}
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
