"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { type TimeEntry, type OvertimeType } from "./use-timesheet";
import { safeFixed } from "@/lib/safe-number";

// ─── Constants ────────────────────────────────────────────────────────────────

export const CATEGORIES = [
  { value: "PLANNED_TASK", label: "原始規劃", dot: "bg-blue-500" },
  { value: "ADDED_TASK", label: "追加任務", dot: "bg-purple-500" },
  { value: "INCIDENT", label: "突發事件", dot: "bg-red-500" },
  { value: "SUPPORT", label: "用戶支援", dot: "bg-orange-500" },
  { value: "ADMIN", label: "行政庶務", dot: "bg-slate-400" },
  { value: "LEARNING", label: "學習成長", dot: "bg-emerald-500" },
] as const;

const OVERTIME_OPTIONS: { value: OvertimeType; label: string; color: string }[] = [
  { value: "NONE", label: "非加班", color: "" },
  { value: "WEEKDAY", label: "平日加班", color: "bg-amber-500" },
  { value: "HOLIDAY", label: "假日加班", color: "bg-red-500" },
];

function getCatDot(cat: string) {
  return CATEGORIES.find((c) => c.value === cat)?.dot ?? "bg-slate-400";
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TimesheetCellProps = {
  entries: TimeEntry[];
  taskId: string | null;
  date: string;
  onQuickSave: (taskId: string | null, date: string, hours: number, existingId?: string) => Promise<void>;
  onFullSave: (
    taskId: string | null,
    date: string,
    hours: number,
    category: string,
    description: string,
    overtimeType: OvertimeType,
    existingId?: string
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onNavigate?: (direction: "next" | "prev" | "up" | "down") => void;
  isWeekend?: boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function TimesheetCell({
  entries,
  taskId,
  date,
  onQuickSave,
  onFullSave,
  onDelete,
  onNavigate,
  isWeekend,
}: TimesheetCellProps) {
  const entry = entries[0] ?? null;
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const hasMultiple = entries.length > 1;

  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  // Expanded edit state
  const [editHours, setEditHours] = useState("");
  const [editCategory, setEditCategory] = useState("PLANNED_TASK");
  const [editDescription, setEditDescription] = useState("");
  const [editOvertimeType, setEditOvertimeType] = useState<OvertimeType>("NONE");
  const [saving, setSaving] = useState(false);

  // Focus input when editing starts
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Close on outside click
  useEffect(() => {
    if (!expanded) return;
    function handler(e: MouseEvent) {
      if (cellRef.current && !cellRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expanded]);

  // Handle click on cell — start inline editing
  const handleClick = useCallback(() => {
    if (expanded) return;
    setEditing(true);
    setInputValue(entry ? safeFixed(entry.hours, 1) : "");
  }, [entry, expanded]);

  // Handle double-click — open expanded editor
  const handleDoubleClick = useCallback(() => {
    if (!entry) return;
    setEditing(false);
    setExpanded(true);
    setEditHours(safeFixed(entry.hours, 1));
    setEditCategory(entry.category);
    setEditDescription(entry.description ?? "");
    setEditOvertimeType((entry.overtimeType as OvertimeType) ?? "NONE");
  }, [entry]);

  // Inline edit keyboard handler
  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const h = parseFloat(inputValue);
        if (!isNaN(h) && h >= 0) {
          if (h === 0 && entry) {
            await onDelete(entry.id);
          } else if (h > 0) {
            await onQuickSave(taskId, date, h, entry?.id);
          }
        }
        setEditing(false);
        if (e.key === "Tab") {
          onNavigate?.(e.shiftKey ? "prev" : "next");
        }
      } else if (e.key === "Escape") {
        setEditing(false);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        onNavigate?.("up");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        onNavigate?.("down");
      }
    },
    [inputValue, entry, taskId, date, onQuickSave, onDelete, onNavigate]
  );

  // Handle blur on inline input
  const handleBlur = useCallback(async () => {
    const h = parseFloat(inputValue);
    if (!isNaN(h) && h >= 0) {
      if (h === 0 && entry) {
        await onDelete(entry.id);
      } else if (h > 0) {
        await onQuickSave(taskId, date, h, entry?.id);
      }
    }
    setEditing(false);
  }, [inputValue, entry, taskId, date, onQuickSave, onDelete]);

  // Expanded editor save
  async function handleExpandedSave() {
    const h = parseFloat(editHours);
    if (isNaN(h) || h < 0) return;
    setSaving(true);
    try {
      await onFullSave(taskId, date, h, editCategory, editDescription, editOvertimeType, entry?.id);
      setExpanded(false);
    } finally {
      setSaving(false);
    }
  }

  // Expanded editor delete
  async function handleExpandedDelete() {
    if (!entry) return;
    setSaving(true);
    try {
      await onDelete(entry.id);
      setExpanded(false);
    } finally {
      setSaving(false);
    }
  }

  const overtimeType = (entry?.overtimeType as OvertimeType) ?? "NONE";
  const hasOvertime = overtimeType !== "NONE";

  return (
    <div ref={cellRef} className="relative" data-testid="timesheet-cell">
      {/* ── Inline edit mode ── */}
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          min="0"
          max="24"
          step="0.5"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className={cn(
            "w-full h-9 text-center text-sm font-medium tabular-nums rounded-md border",
            "bg-background border-ring/50 text-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring/30"
          )}
          data-testid="cell-input"
        />
      ) : (
        /* ── Display mode ── */
        <button
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          className={cn(
            "w-full h-9 rounded-md border text-xs transition-all relative",
            "focus:outline-none focus:ring-2 focus:ring-ring/30",
            isWeekend && "bg-muted/20",
            entry && totalHours > 0
              ? "font-medium border-border/60 hover:border-ring/40"
              : "border-dashed border-border/40 text-muted-foreground/40 hover:border-ring/30 hover:text-muted-foreground hover:bg-accent/20"
          )}
          data-testid="cell-button"
        >
          {entry && totalHours > 0 ? (
            <span className="flex items-center justify-center gap-1">
              {/* Category color dot */}
              <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", getCatDot(entry.category))} />
              <span className="tabular-nums">{safeFixed(totalHours, 1)}</span>
              {/* Overtime indicator */}
              {hasOvertime && (
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full flex-shrink-0",
                    overtimeType === "WEEKDAY" ? "bg-amber-500" : "bg-red-500"
                  )}
                  title={overtimeType === "WEEKDAY" ? "平日加班" : "假日加班"}
                />
              )}
              {/* Multiple entries indicator */}
              {hasMultiple && (
                <span className="text-[9px] text-muted-foreground/60">+{entries.length - 1}</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground/30">—</span>
          )}
        </button>
      )}

      {/* ── Expanded editor (on double-click) ── */}
      {expanded && (
        <div
          className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 w-64 bg-card border border-border rounded-xl shadow-2xl p-3 space-y-2.5"
          data-testid="cell-expanded"
        >
          <div>
            <label className="block text-xs text-muted-foreground mb-1">工時（小時）</label>
            <input
              type="number"
              min="0"
              max="24"
              step="0.5"
              autoFocus
              value={editHours}
              onChange={(e) => setEditHours(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleExpandedSave();
                if (e.key === "Escape") setExpanded(false);
              }}
              className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">分類</label>
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">備註</label>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleExpandedSave();
              }}
              className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="可選備註..."
            />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">加班類型</label>
            <select
              value={editOvertimeType}
              onChange={(e) => setEditOvertimeType(e.target.value as OvertimeType)}
              className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              {OVERTIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleExpandedSave}
              disabled={saving}
              className="flex-1 bg-accent hover:bg-accent/80 text-accent-foreground text-xs font-medium py-1.5 rounded-md transition-colors disabled:opacity-50"
            >
              {saving ? "儲存中..." : "儲存"}
            </button>
            {entry && (
              <button
                onClick={handleExpandedDelete}
                disabled={saving}
                className="px-2.5 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded-md transition-colors disabled:opacity-50"
              >
                刪除
              </button>
            )}
            <button
              onClick={() => setExpanded(false)}
              className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground text-xs rounded-md transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
