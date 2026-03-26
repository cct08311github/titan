"use client";

import { type TaskOption } from "../use-timesheet";
import { CATEGORIES } from "../timesheet-cell";
import { timeToHours, formatDuration } from "../calendar-utils";
import { DAY_LABELS } from "./copy-day-menu";

type EntryFormData = {
  startTime: string;
  endTime: string;
  taskId?: string;
  category: string;
  description: string;
};

type EntryFormProps = {
  mode: "create" | "edit";
  /** Day index for title display (create mode only). */
  dayIndex?: number;
  /** Date string for title display (create mode only). */
  dateStr?: string;
  form: EntryFormData;
  tasks: TaskOption[];
  onFormChange: (updates: Partial<EntryFormData>) => void;
  onSave: () => void;
  onDelete?: () => void;
  onCancel: () => void;
};

export type { EntryFormData };

export function EntryForm({
  mode,
  dayIndex,
  dateStr,
  form,
  tasks,
  onFormChange,
  onSave,
  onDelete,
  onCancel,
}: EntryFormProps) {
  const prefix = mode === "create" ? "week-create" : "week-edit";
  const duration = Math.max(0, timeToHours(form.endTime) - timeToHours(form.startTime));

  return (
    <div
      className="border border-border rounded-xl bg-card shadow-lg p-4 space-y-3"
      data-testid={`${prefix}-form`}
    >
      <div className="text-sm font-medium">
        {mode === "create"
          ? `新增工時 — 週${DAY_LABELS[dayIndex ?? 0]}（${dateStr ?? ""}）`
          : "編輯工時紀錄"}
      </div>

      {/* Time inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">開始時間</label>
          <input
            type="time"
            value={form.startTime}
            onChange={(e) => onFormChange({ startTime: e.target.value })}
            className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            data-testid={`${prefix}-start-time`}
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">結束時間</label>
          <input
            type="time"
            value={form.endTime}
            onChange={(e) => onFormChange({ endTime: e.target.value })}
            className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            data-testid={`${prefix}-end-time`}
          />
        </div>
      </div>

      {form.startTime && form.endTime && (
        <div className="text-xs text-muted-foreground tabular-nums">
          時長：{formatDuration(duration)}
        </div>
      )}

      {/* Task select (create mode only) */}
      {mode === "create" && (
        <div>
          <label className="block text-xs text-muted-foreground mb-1">任務</label>
          <select
            value={form.taskId ?? ""}
            onChange={(e) => onFormChange({ taskId: e.target.value })}
            className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            data-testid={`${prefix}-task-select`}
          >
            <option value="">自由工時（無任務）</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>
      )}

      {/* Category */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1">分類</label>
        <select
          value={form.category}
          onChange={(e) => onFormChange({ category: e.target.value })}
          className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          data-testid={`${prefix}-category-select`}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1">備註</label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => onFormChange({ description: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") onCancel();
          }}
          className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="可選備註..."
          data-testid={`${prefix}-description`}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          className="flex-1 bg-accent hover:bg-accent/80 text-accent-foreground text-xs font-medium py-2 rounded-md transition-colors"
          data-testid={`${prefix}-save-btn`}
        >
          儲存
        </button>
        {mode === "edit" && onDelete && (
          <button
            onClick={onDelete}
            className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded-md transition-colors"
            data-testid={`${prefix}-delete-btn`}
          >
            刪除
          </button>
        )}
        <button
          onClick={onCancel}
          className="px-3 py-2 text-muted-foreground hover:text-foreground text-xs rounded-md transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );
}
