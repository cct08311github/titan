"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export type TimeEntry = {
  id: string;
  taskId: string | null;
  date: string;
  hours: number;
  category: string;
  description: string | null;
};

const CATEGORIES = [
  { value: "PLANNED_TASK", label: "原始規劃", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { value: "ADDED_TASK", label: "追加任務", color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  { value: "INCIDENT", label: "突發事件", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  { value: "SUPPORT", label: "用戶支援", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  { value: "ADMIN", label: "行政庶務", color: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30" },
  { value: "LEARNING", label: "學習成長", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
];

function getCatStyle(cat: string) {
  return CATEGORIES.find((c) => c.value === cat)?.color ?? "bg-zinc-800 text-zinc-400 border-zinc-700";
}

type TimeEntryCellProps = {
  entry?: TimeEntry;
  taskId: string | null;
  date: string;
  onSave: (taskId: string | null, date: string, hours: number, category: string, description: string, existingId?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function TimeEntryCell({ entry, taskId, date, onSave, onDelete }: TimeEntryCellProps) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(entry?.hours?.toString() ?? "");
  const [category, setCategory] = useState(entry?.category ?? "PLANNED_TASK");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Sync props → state when entry changes
  useEffect(() => {
    if (!open) {
      setHours(entry?.hours?.toString() ?? "");
      setCategory(entry?.category ?? "PLANNED_TASK");
      setDescription(entry?.description ?? "");
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

  return (
    <div ref={ref} className="relative">
      {/* Cell display */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full min-h-[36px] rounded-md border text-xs transition-all",
          entry && entry.hours > 0
            ? cn("font-medium px-2 py-1", getCatStyle(entry.category))
            : "border-dashed border-zinc-800 text-zinc-700 hover:border-zinc-600 hover:text-zinc-500 hover:bg-zinc-800/30"
        )}
      >
        {entry && entry.hours > 0 ? (
          <span className="tabular-nums">{entry.hours}h</span>
        ) : (
          <span>+</span>
        )}
      </button>

      {/* Popover editor */}
      {open && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 w-56 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-3 space-y-2.5">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">工時（小時）</label>
            <input
              type="number"
              min="0"
              max="24"
              step="0.5"
              autoFocus
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-2.5 py-1.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">分類</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500 cursor-pointer"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">備註</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              placeholder="可選備註..."
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs font-medium py-1.5 rounded-md transition-colors disabled:opacity-50"
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
              className="px-2.5 py-1.5 text-zinc-500 hover:text-zinc-300 text-xs rounded-md transition-colors"
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
