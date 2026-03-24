"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { TimeEntryCell, type TimeEntry } from "./time-entry-cell";
import { safeFixed } from "@/lib/safe-number";

export type TaskRow = {
  taskId: string | null;
  label: string;
};

const DAYS = ["一", "二", "三", "四", "五"];

type TimesheetGridProps = {
  weekStart: Date;
  taskRows: TaskRow[];
  entries: TimeEntry[];
  onCellSave: (taskId: string | null, date: string, hours: number, category: string, description: string, existingId?: string) => Promise<void>;
  onCellDelete: (id: string) => Promise<void>;
};

function getDateStr(weekStart: Date, dayOffset: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().split("T")[0];
}

function formatDateLabel(weekStart: Date, offset: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + offset);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function TimesheetGrid({ weekStart, taskRows, entries, onCellSave, onCellDelete }: TimesheetGridProps) {
  const getEntry = useCallback(
    (taskId: string | null, dateStr: string) =>
      entries.find(
        (e) => (e.taskId ?? null) === (taskId ?? null) && e.date.split("T")[0] === dateStr
      ),
    [entries]
  );

  // Daily totals
  const dailyTotals = DAYS.map((_, i) => {
    const dateStr = getDateStr(weekStart, i);
    return entries
      .filter((e) => e.date.split("T")[0] === dateStr)
      .reduce((sum, e) => sum + e.hours, 0);
  });

  // Row totals
  const rowTotals = taskRows.map((row) =>
    entries
      .filter((e) => (e.taskId ?? null) === (row.taskId ?? null))
      .reduce((sum, e) => sum + e.hours, 0)
  );

  const grandTotal = entries.reduce((sum, e) => sum + e.hours, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground w-48 sticky left-0 bg-card z-10">
              任務
            </th>
            {DAYS.map((day, i) => (
              <th key={i} className="px-2 py-2.5 text-center min-w-[100px]">
                <div className="text-xs font-semibold text-muted-foreground">週{day}</div>
                <div className="text-xs text-muted-foreground/60 mt-0.5">{formatDateLabel(weekStart, i)}</div>
              </th>
            ))}
            <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground min-w-[64px]">
              合計
            </th>
          </tr>
        </thead>

        <tbody>
          {taskRows.map((row, rowIdx) => (
            <tr key={row.taskId ?? `free-${rowIdx}`} className="border-b border-border/50 hover:bg-accent/20 transition-colors group">
              <td className="px-3 py-2 sticky left-0 bg-card group-hover:bg-accent/20 z-10">
                <span className="text-xs text-muted-foreground truncate block max-w-[176px]" title={row.label}>
                  {row.label}
                </span>
              </td>
              {DAYS.map((_, dayIdx) => {
                const dateStr = getDateStr(weekStart, dayIdx);
                const entry = getEntry(row.taskId, dateStr);
                return (
                  <td key={dayIdx} className="px-1 py-1 text-center">
                    <TimeEntryCell
                      entry={entry}
                      taskId={row.taskId}
                      date={dateStr}
                      onSave={onCellSave}
                      onDelete={onCellDelete}
                    />
                  </td>
                );
              })}
              <td className="px-3 py-2 text-center">
                <span className={cn("text-xs font-medium tabular-nums", rowTotals[rowIdx] > 0 ? "text-foreground" : "text-muted-foreground/40")}>
                  {rowTotals[rowIdx] > 0 ? safeFixed(rowTotals[rowIdx], 1) : "—"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr className="border-t border-border bg-muted/30">
            <td className="px-3 py-2.5 sticky left-0 bg-muted/30 z-10">
              <span className="text-xs font-semibold text-muted-foreground">每日合計</span>
            </td>
            {dailyTotals.map((total, i) => (
              <td key={i} className="px-2 py-2.5 text-center">
                <span className={cn("text-xs font-semibold tabular-nums", total > 8 ? "text-amber-500" : total > 0 ? "text-emerald-500" : "text-muted-foreground/40")}>
                  {total > 0 ? safeFixed(total, 1) : "—"}
                </span>
              </td>
            ))}
            <td className="px-3 py-2.5 text-center">
              <span className="text-xs font-bold text-foreground tabular-nums">{safeFixed(grandTotal, 1)}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
