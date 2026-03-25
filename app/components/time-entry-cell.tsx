"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

export type TimeEntry = {
  id: string;
  taskId: string | null;
  date: string;
  hours: number;
  startTime?: string | null;
  endTime?: string | null;
  isRunning?: boolean;
  overtime?: boolean;
  category: string;
  description: string | null;
};

const CATEGORIES = [
  { value: "PLANNED_TASK", label: "原始規劃", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { value: "ADDED_TASK", label: "追加任務", color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  { value: "INCIDENT", label: "突發事件", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  { value: "SUPPORT", label: "用戶支援", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  { value: "ADMIN", label: "行政庶務", color: "bg-slate-200/50 text-slate-600 border-slate-300/50" },
  { value: "LEARNING", label: "學習成長", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
];

function getCatStyle(cat: string) {
  return CATEGORIES.find((c) => c.value === cat)?.color ?? "bg-muted text-muted-foreground border-border";
}

type TimeEntryCellProps = {
  entry?: TimeEntry;
  taskId: string | null;
  date: string;
  onSave: (taskId: string | null, date: string, hours: number, category: string, description: string, existingId?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /** TS-21: Keyboard navigation callback — called on Tab/Shift+Tab to move between cells */
  onNavigate?: (direction: "next" | "prev") => void;
};

export function TimeEntryCell({ entry, taskId, date, onSave, onDelete, onNavigate }: TimeEntryCellProps) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(entry?.hours?.toString() ?? "");
  const [category, setCategory] = useState(entry?.category ?? "PLANNED_TASK");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [overtime, setOvertime] = useState(entry?.overtime ?? false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Sync props → state when entry changes
  useEffect(() => {
    if (!open) {
      setHours(entry?.hours?.toString() ?? "");
      setCategory(entry?.category ?? "PLANNED_TASK");
      setDescription(entry?.description ?? "");
      setOvertime(entry?.overtime ?? false);
    }
  }, [entry, open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function handleSave() {
    const h = parseFloat(hours);
    if (isNaN(h) || h < 0) return;
    setSaving(true);
    try {
      await onSave(taskId, date, h, category, description, entry?.id);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!entry) return;
    setSaving(true);
    try {
      await onDelete(entry.id);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  /**
   * TS-21: Handle keyboard events on the cell button.
   * Enter opens the editor popover.
   */
  const handleButtonKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        setOpen(true);
      }
    },
    []
  );

  /**
   * TS-21: Handle keyboard events inside the editor popover.
   * - Escape closes the editor
   * - Tab navigates to the next cell
   * - Shift+Tab navigates to the previous cell
   * - Enter saves (handled by individual inputs)
   */
  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        setOpen(false);
        onNavigate?.(e.shiftKey ? "prev" : "next");
      }
    },
    [onNavigate]
  );

  return (
    <div ref={ref} className="relative">
      {/* Cell display */}
      <button
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleButtonKeyDown}
        className={cn(
          "w-full min-h-[36px] rounded-md border text-xs transition-all",
          entry && entry.hours > 0
            ? cn("font-medium px-2 py-1", getCatStyle(entry.category))
            : "border-dashed border-border text-muted-foreground/50 hover:border-ring/50 hover:text-muted-foreground hover:bg-accent/30"
        )}
      >
        {entry && entry.hours > 0 ? (
          <span className="tabular-nums inline-flex items-center gap-1">
            {entry.hours}h
            {entry.overtime && (
              <span className="inline-block px-1 py-0.5 text-[10px] font-bold leading-none bg-amber-500/30 text-amber-400 border border-amber-500/40 rounded">
                OT
              </span>
            )}
          </span>
        ) : (
          <span>+</span>
        )}
      </button>

      {/* Popover editor */}
      {open && (
        <div
          className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 w-56 bg-card border border-border rounded-xl shadow-2xl p-3 space-y-2.5"
          onKeyDown={handleEditorKeyDown}
        >
          <div>
            <label className="block text-xs text-muted-foreground mb-1">工時（小時）</label>
            <input
              type="number"
              min="0"
              max="24"
              step="0.5"
              autoFocus
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">分類</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="可選備註..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`overtime-${entry?.id ?? 'new'}-${date}`}
              checked={overtime}
              onChange={(e) => setOvertime(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border text-amber-500 focus:ring-amber-500/50"
            />
            <label htmlFor={`overtime-${entry?.id ?? 'new'}-${date}`} className="text-xs text-muted-foreground cursor-pointer">
              加班
            </label>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-accent hover:bg-accent/80 text-accent-foreground text-xs font-medium py-1.5 rounded-md transition-colors disabled:opacity-50"
            >
              {saving ? "儲存中..." : "儲存"}
            </button>
            {entry && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-2.5 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded-md transition-colors disabled:opacity-50"
              >
                刪除
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
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

export { CATEGORIES };
