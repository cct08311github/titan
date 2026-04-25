"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { safeFixed } from "@/lib/safe-number";
import { TimesheetCell } from "./timesheet-cell";
import { type TimeEntry, type TaskRow, type OvertimeType, type TaskOption, type SubTaskOption } from "./use-timesheet";
import { Plus } from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type TimesheetGridProps = {
  weekStart: Date;
  taskRows: TaskRow[];
  entries: TimeEntry[];
  tasks: TaskOption[];
  dailyTotals: number[];
  weeklyTotal: number;
  dayLabels: string[];
  daysCount: number;
  subTasksMap?: Map<string, SubTaskOption[]>;  // Issue #933
  getDateStr: (offset: number) => string;
  formatDateLabel: (offset: number) => string;
  getEntriesForCell: (taskId: string | null, dateStr: string) => TimeEntry[];
  onQuickSave: (taskId: string | null, date: string, hours: number, existingId?: string) => Promise<void>;
  onFullSave: (
    taskId: string | null,
    date: string,
    hours: number,
    category: string,
    description: string,
    overtimeType: OvertimeType,
    existingId?: string,
    subTaskId?: string | null,             // Issue #933
    startTime?: string | null,             // Issue #1008
    endTime?: string | null                // Issue #1008
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddTaskRow: (taskId: string, label: string) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function TimesheetGrid({
  taskRows,
  entries,
  tasks,
  dailyTotals,
  weeklyTotal,
  dayLabels,
  daysCount,
  subTasksMap = new Map(),
  getDateStr,
  formatDateLabel,
  getEntriesForCell,
  onQuickSave,
  onFullSave,
  onDelete,
  onAddTaskRow,
}: TimesheetGridProps) {
  const gridRef = useRef<HTMLTableElement>(null);
  const [showTaskSelector, setShowTaskSelector] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");

  // Issue #1539-1: when the grid mounts (or date range changes to a week
  // containing today), scroll today's column into view so users land on
  // the cell they actually want to edit, not on Monday.
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDayIdx = (() => {
    for (let i = 0; i < daysCount; i++) {
      if (getDateStr(i) === todayStr) return i;
    }
    return -1;
  })();
  useEffect(() => {
    if (todayDayIdx < 0 || !gridRef.current) return;
    const headerCell = gridRef.current.querySelector<HTMLElement>(
      `th[data-day="${todayDayIdx}"]`
    );
    // JSDOM doesn't implement scrollIntoView — guard so jest tests don't crash.
    if (typeof headerCell?.scrollIntoView === "function") {
      headerCell.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }
  }, [todayDayIdx]);

  // Row totals — Issue #1538: hours may be Decimal-as-string.
  const rowTotals = taskRows.map((row) =>
    entries
      .filter((e) => (e.taskId ?? null) === (row.taskId ?? null))
      .reduce((sum, e) => sum + Number(e.hours ?? 0), 0)
  );

  // Navigation callback for cells
  const handleNavigate = useCallback(
    (rowIdx: number, dayIdx: number, direction: "next" | "prev" | "up" | "down") => {
      if (!gridRef.current) return;
      let targetRow = rowIdx;
      let targetDay = dayIdx;

      switch (direction) {
        case "next":
          targetDay++;
          if (targetDay >= daysCount) {
            targetDay = 0;
            targetRow++;
          }
          break;
        case "prev":
          targetDay--;
          if (targetDay < 0) {
            targetDay = daysCount - 1;
            targetRow--;
          }
          break;
        case "up":
          targetRow--;
          break;
        case "down":
          targetRow++;
          break;
      }

      if (targetRow < 0 || targetRow >= taskRows.length) return;
      if (targetDay < 0 || targetDay >= daysCount) return;

      // Find and click the target cell button
      const selector = `[data-row="${targetRow}"][data-day="${targetDay}"] [data-testid="cell-button"]`;
      const btn = gridRef.current.querySelector<HTMLButtonElement>(selector);
      btn?.click();
    },
    [daysCount, taskRows.length]
  );

  // Filtered tasks for add-row selector
  const availableTaskIds = new Set(taskRows.map((r) => r.taskId).filter(Boolean));
  const filteredTasks = tasks
    .filter((t) => !availableTaskIds.has(t.id))
    .filter((t) => !taskSearch || t.title.toLowerCase().includes(taskSearch.toLowerCase()));

  return (
    <div className="overflow-x-auto" data-testid="timesheet-grid">
      <table ref={gridRef} className="w-full border-collapse text-sm">
        {/* ── Header ── */}
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground w-48 min-w-[180px] sticky left-0 bg-card z-10">
              任務
            </th>
            {dayLabels.map((day, i) => {
              const isWeekend = i >= 5;
              const isToday = i === todayDayIdx;
              return (
                <th
                  key={i}
                  data-day={i}
                  className={cn(
                    "px-1 py-2.5 text-center min-w-[72px]",
                    isWeekend && "bg-muted/10",
                    // Issue #1539-1: visually highlight today's column header
                    isToday && "bg-primary/8 border-b-2 border-primary"
                  )}
                >
                  <div className={cn(
                    "text-xs font-semibold",
                    isToday ? "text-primary" : isWeekend ? "text-muted-foreground/60" : "text-muted-foreground"
                  )}>
                    週{day}
                  </div>
                  <div className={cn(
                    "text-[10px] mt-0.5",
                    isToday ? "text-primary/80 font-medium" : "text-muted-foreground/50"
                  )}>
                    {isToday ? "今天" : formatDateLabel(i)}
                  </div>
                </th>
              );
            })}
            <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground min-w-[56px]">
              合計
            </th>
          </tr>
        </thead>

        {/* ── Body ── */}
        <tbody>
          {taskRows.length === 0 ? (
            <tr>
              <td colSpan={daysCount + 2} className="text-center py-12 text-sm text-muted-foreground">
                <div className="space-y-2">
                  <p>本週尚無工時記錄</p>
                  <p className="text-xs text-muted-foreground/60">點擊下方「+ 新增任務列」開始記錄</p>
                </div>
              </td>
            </tr>
          ) : (
            taskRows.map((row, rowIdx) => (
              <tr
                key={row.taskId ?? `free-${rowIdx}`}
                className="border-b border-border/40 hover:bg-accent/10 transition-colors group"
              >
                <td className="px-3 py-1.5 sticky left-0 bg-card group-hover:bg-accent/10 z-10">
                  {(() => {
                    // Issue #933: show subtask info in label
                    const rowEntries = entries.filter((e) => (e.taskId ?? null) === (row.taskId ?? null));
                    const subTaskTitles = new Set(
                      rowEntries
                        .filter((e) => e.subTask?.title)
                        .map((e) => e.subTask!.title)
                    );
                    const subLabel = subTaskTitles.size === 1
                      ? ` > ${[...subTaskTitles][0]}`
                      : subTaskTitles.size > 1
                        ? ` > (${subTaskTitles.size} 子任務)`
                        : "";
                    const fullLabel = `${row.label}${subLabel}`;
                    return row.taskId ? (
                        <Link
                          href={`/kanban?task=${row.taskId}`}
                          className="text-xs text-muted-foreground truncate block max-w-[168px] hover:text-primary transition-colors"
                          title={fullLabel}
                        >
                          # {row.label}
                          {subLabel && <span className="text-muted-foreground/60">{subLabel}</span>}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground truncate block max-w-[168px]" title={fullLabel}>
                          {row.label}
                        </span>
                      );
                  })()}
                </td>
                {Array.from({ length: daysCount }, (_, dayIdx) => {
                  const dateStr = getDateStr(dayIdx);
                  const cellEntries = getEntriesForCell(row.taskId, dateStr);
                  const isWeekend = dayIdx >= 5;
                  const cellSubTasks = row.taskId ? (subTasksMap.get(row.taskId) ?? []) : [];
                  return (
                    <td
                      key={dayIdx}
                      className={cn("px-1 py-1", isWeekend && "bg-muted/10")}
                      data-row={rowIdx}
                      data-day={dayIdx}
                    >
                      <TimesheetCell
                        entries={cellEntries}
                        taskId={row.taskId}
                        date={dateStr}
                        subTasks={cellSubTasks}
                        onQuickSave={onQuickSave}
                        onFullSave={onFullSave}
                        onDelete={onDelete}
                        onNavigate={(dir) => handleNavigate(rowIdx, dayIdx, dir)}
                        isWeekend={isWeekend}
                      />
                    </td>
                  );
                })}
                <td className="px-3 py-1.5 text-center">
                  <span
                    className={cn(
                      "text-xs font-medium tabular-nums",
                      rowTotals[rowIdx] > 0 ? "text-foreground" : "text-muted-foreground/30"
                    )}
                  >
                    {rowTotals[rowIdx] > 0 ? safeFixed(rowTotals[rowIdx], 1) : "—"}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>

        {/* ── Footer: daily totals ── */}
        <tfoot>
          <tr className="border-t border-border bg-muted/20">
            <td className="px-3 py-2.5 sticky left-0 bg-muted/20 z-10">
              <span className="text-xs font-semibold text-muted-foreground">每日合計</span>
            </td>
            {dailyTotals.map((total, i) => {
              const isWeekend = i >= 5;
              return (
                <td key={i} className={cn("px-1 py-2.5 text-center", isWeekend && "bg-muted/10")}>
                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums",
                      total > 8
                        ? "text-amber-500"
                        : total > 0
                          ? "text-emerald-500"
                          : "text-muted-foreground/30"
                    )}
                  >
                    {total > 0 ? safeFixed(total, 1) : "—"}
                  </span>
                </td>
              );
            })}
            <td className="px-3 py-2.5 text-center">
              <span className="text-xs font-bold text-foreground tabular-nums">
                {safeFixed(weeklyTotal, 1)}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>

      {/* ── Add task row button ── */}
      <div className="px-3 py-2 border-t border-border/30">
        {showTaskSelector ? (
          <div className="space-y-2">
            <input
              type="text"
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              placeholder="搜尋任務..."
              autoFocus
              className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowTaskSelector(false);
                  setTaskSearch("");
                }
              }}
              data-testid="task-search-input"
            />
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {filteredTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 py-2 text-center">無可用任務</p>
              ) : (
                filteredTasks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      onAddTaskRow(t.id, t.title);
                      setShowTaskSelector(false);
                      setTaskSearch("");
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-foreground hover:bg-accent/50 rounded-md transition-colors truncate"
                  >
                    {t.title}
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => {
                setShowTaskSelector(false);
                setTaskSearch("");
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowTaskSelector(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            data-testid="add-task-row-btn"
          >
            <Plus className="h-3.5 w-3.5" />
            新增任務列
          </button>
        )}
      </div>
    </div>
  );
}
