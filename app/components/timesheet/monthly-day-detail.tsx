"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import type { MonthlyEntry, ApprovalStatus } from "./use-monthly-timesheet";

type MonthlyDayDetailProps = {
  memberName: string;
  date: string;
  entries: MonthlyEntry[];
  selectedEntryIds: Set<string>;
  onToggleEntry: (entryId: string) => void;
  onClose: () => void;
};

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: "待審核",
  APPROVED: "已核准",
  REJECTED: "已駁回",
};

const STATUS_COLORS: Record<ApprovalStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
};

const CATEGORY_LABELS: Record<string, string> = {
  PLANNED_TASK: "計畫任務",
  ADDED_TASK: "追加任務",
  INCIDENT: "事件處理",
  SUPPORT: "技術支援",
  ADMIN: "行政庶務",
  LEARNING: "學習進修",
};

export function MonthlyDayDetail({
  memberName,
  date,
  entries,
  selectedEntryIds,
  onToggleEntry,
  onClose,
}: MonthlyDayDetailProps) {
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);

  return (
    <div className="border border-border rounded-lg bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold">{memberName}</h4>
          <p className="text-xs text-muted-foreground">{date} — {totalHours.toFixed(1)} 小時</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted transition-colors"
          aria-label="關閉"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">當日無工時記錄</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                "flex items-start gap-2 p-2 rounded border border-border/50 text-xs",
                entry.isRunning && "opacity-50"
              )}
            >
              <input
                type="checkbox"
                checked={selectedEntryIds.has(entry.id)}
                onChange={() => onToggleEntry(entry.id)}
                disabled={entry.isRunning}
                className="mt-0.5 rounded border-border"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{entry.hours.toFixed(1)}h</span>
                  <span className={cn("px-1.5 py-0.5 rounded text-[10px]", STATUS_COLORS[entry.approvalStatus])}>
                    {STATUS_LABELS[entry.approvalStatus]}
                  </span>
                  {entry.isRunning && (
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 text-[10px]">
                      計時中
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground mt-0.5">
                  {CATEGORY_LABELS[entry.category] || entry.category}
                  {entry.task && <> — {entry.task.title}</>}
                </div>
                {entry.description && (
                  <div className="text-muted-foreground/70 mt-0.5 truncate">{entry.description}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
