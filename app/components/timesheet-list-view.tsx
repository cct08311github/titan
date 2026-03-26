"use client";

import { cn } from "@/lib/utils";
import { safeFixed } from "@/lib/safe-number";
import { type TimeEntry, CATEGORIES } from "./time-entry-cell";

// ── Types ────────────────────────────────────────────────────────────────────

type TimesheetListViewProps = {
  entries: TimeEntry[];
  onDelete?: (id: string) => Promise<void>;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryLabel(cat: string): string {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

function getCategoryColor(cat: string): string {
  return CATEGORIES.find((c) => c.value === cat)?.color ?? "bg-muted text-muted-foreground border-border";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`;
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "—";
  const d = new Date(timeStr);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export function TimesheetListView({ entries, onDelete }: TimesheetListViewProps) {
  // Sort by date descending, then by startTime descending
  const sorted = [...entries].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    if (a.startTime && b.startTime) return b.startTime.localeCompare(a.startTime);
    return 0;
  });

  // Calculate daily totals
  const dailyTotals = new Map<string, number>();
  for (const entry of entries) {
    const dateKey = entry.date.split("T")[0];
    dailyTotals.set(dateKey, (dailyTotals.get(dateKey) ?? 0) + entry.hours);
  }

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        本週尚無工時記錄
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" data-testid="list-view-table">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">日期</th>
            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">開始</th>
            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">結束</th>
            <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">工時</th>
            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">任務</th>
            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell">子任務</th>
            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">分類</th>
            <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">備註</th>
            {onDelete && (
              <th className="text-center px-3 py-2.5 text-xs font-medium text-muted-foreground w-16">操作</th>
            )}
          </tr>
        </thead>

        <tbody>
          {sorted.map((entry) => {
            const task = (entry as Record<string, unknown>).task as { title: string } | null | undefined;
            return (
              <tr
                key={entry.id}
                className="border-b border-border/50 hover:bg-accent/20 transition-colors"
                data-testid="list-view-row"
              >
                <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">
                  {formatDate(entry.date)}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums hidden sm:table-cell" data-testid="start-time">
                  {formatTime(entry.startTime)}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums hidden sm:table-cell" data-testid="end-time">
                  {formatTime(entry.endTime)}
                </td>
                <td className="px-3 py-2 text-right text-xs font-medium text-foreground tabular-nums">
                  {safeFixed(entry.hours, 1)}h
                </td>
                <td className="px-3 py-2 text-xs text-foreground max-w-[200px] truncate" title={task?.title ?? "自由工時"}>
                  {task?.title ?? "自由工時"}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground max-w-[150px] truncate hidden lg:table-cell">
                  {(entry as Record<string, unknown>).subTask ? ((entry as Record<string, unknown>).subTask as { title: string })?.title : "—"}
                </td>
                <td className="px-3 py-2">
                  <span className={cn("inline-block px-2 py-0.5 text-xs rounded-md border", getCategoryColor(entry.category))}>
                    {getCategoryLabel(entry.category)}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px] truncate hidden md:table-cell" title={entry.description ?? ""}>
                  {entry.description ?? "—"}
                </td>
                {onDelete && (
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => onDelete(entry.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      刪除
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr className="border-t border-border bg-muted/30">
            <td className="px-3 py-2.5 text-xs font-semibold text-muted-foreground" colSpan={3}>
              合計
            </td>
            <td className="px-3 py-2.5 text-right text-xs font-bold text-foreground tabular-nums">
              {safeFixed(totalHours, 1)}h
            </td>
            <td colSpan={onDelete ? 5 : 4} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
