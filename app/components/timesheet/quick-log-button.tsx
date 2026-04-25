"use client";

/**
 * Quick-Log Button — Issue #1539-2 (from #1538 audit backlog)
 *
 * Problem: /timesheet has timer, grid, list, and calendar views — but no
 * always-visible entry point for "I just finished something, log it now."
 * Users in calendar/list/mobile-list view had to navigate back to grid,
 * find a cell, and double-click. That breaks flow.
 *
 * Design:
 * - Floating sticky button on /timesheet, visible across all view modes
 * - Click opens a focused modal with task / date / hours / category / note
 * - Defaults: today's date, hours=1.0, category=last-used or PLANNED_TASK
 * - Keyboard: Esc closes, Cmd/Ctrl+Enter saves
 * - On save: calls hook saveEntry() so existing optimistic update + stats refresh kicks in
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatLocalDate } from "@/lib/utils/date";
import type { TaskOption, OvertimeType } from "./use-timesheet";

// ─── Types ────────────────────────────────────────────────────────────────────

type QuickLogButtonProps = {
  tasks: TaskOption[];
  onSave: (
    taskId: string | null,
    date: string,
    hours: number,
    category: string,
    description: string,
    overtimeType: OvertimeType,
  ) => Promise<void>;
  /**
   * Issue #1539-8: optional controlled mode so other entry points
   * (e.g. empty state CTA) can trigger the same modal.
   * If omitted, component manages its own open state internally.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "PLANNED_TASK", label: "計畫任務" },
  { value: "ADDED_TASK", label: "追加任務" },
  { value: "INCIDENT", label: "事件處理" },
  { value: "SUPPORT", label: "技術支援" },
  { value: "ADMIN", label: "行政庶務" },
  { value: "LEARNING", label: "學習進修" },
];

const LAST_CATEGORY_KEY = "titan:quickLog:lastCategory";

// ─── Component ───────────────────────────────────────────────────────────────

export function QuickLogButton({ tasks, onSave, open: controlledOpen, onOpenChange }: QuickLogButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [submitting, setSubmitting] = useState(false);
  const [taskId, setTaskId] = useState<string>("");
  const [date, setDate] = useState<string>(() => formatLocalDate(new Date()));
  const [hours, setHours] = useState<string>("1");
  const [category, setCategory] = useState<string>("PLANNED_TASK");
  const [description, setDescription] = useState<string>("");
  const hoursInputRef = useRef<HTMLInputElement | null>(null);

  // Restore last-used category from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(LAST_CATEGORY_KEY);
    if (saved && CATEGORY_OPTIONS.some((c) => c.value === saved)) {
      setCategory(saved);
    }
  }, []);

  // When modal opens: reset date to today, focus hours input, restore last category
  useEffect(() => {
    if (!open) return;
    setDate(formatLocalDate(new Date()));
    // Focus hours input on next tick so Modal mount finishes
    const t = setTimeout(() => hoursInputRef.current?.select(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleSave = useCallback(async () => {
    const parsed = Number.parseFloat(hours);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("請輸入大於 0 的時數");
      hoursInputRef.current?.focus();
      return;
    }
    if (parsed > 24) {
      toast.error("單筆時數不得超過 24 小時");
      hoursInputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await onSave(
        taskId || null,
        date,
        parsed,
        category,
        description.trim(),
        "NONE",
      );
      // Persist category preference
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LAST_CATEGORY_KEY, category);
      }
      toast.success(`已記錄 ${parsed} 小時`);
      setOpen(false);
      // Reset transient fields
      setHours("1");
      setDescription("");
    } catch (e) {
      // saveEntry already toasts on parsing errors at server level; this is the fallback.
      toast.error("儲存失敗，請稍後再試");
      console.error("[quick-log] save failed", e);
    } finally {
      setSubmitting(false);
    }
  }, [taskId, date, hours, category, description, onSave]);

  function handleSubmitKey(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  }

  return (
    <>
      {/* Trigger button — sits inline in the toolbar row */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
          "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
        data-testid="quick-log-trigger"
        aria-label="快速記時數"
      >
        <Plus className="h-3.5 w-3.5" />
        快速記時數
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-log-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          data-testid="quick-log-modal"
        >
          <div
            className="w-full sm:max-w-md bg-card border border-border rounded-t-xl sm:rounded-xl shadow-xl p-4 space-y-3"
            onKeyDown={handleSubmitKey}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 id="quick-log-title" className="text-sm font-semibold">
                快速記時數
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-muted transition-colors"
                aria-label="關閉"
                data-testid="quick-log-close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Hours — primary field, autoFocus */}
            <div>
              <label htmlFor="quick-log-hours" className="block text-xs font-medium text-muted-foreground mb-1">
                時數
              </label>
              <input
                ref={hoursInputRef}
                id="quick-log-hours"
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                max="24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full px-3 py-2 text-base border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="quick-log-hours"
              />
            </div>

            {/* Date */}
            <div>
              <label htmlFor="quick-log-date" className="block text-xs font-medium text-muted-foreground mb-1">
                日期
              </label>
              <input
                id="quick-log-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="quick-log-date"
              />
            </div>

            {/* Task select */}
            <div>
              <label htmlFor="quick-log-task" className="block text-xs font-medium text-muted-foreground mb-1">
                任務
              </label>
              <select
                id="quick-log-task"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                data-testid="quick-log-task"
              >
                <option value="">自由工時（無任務）</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label htmlFor="quick-log-category" className="block text-xs font-medium text-muted-foreground mb-1">
                類別
              </label>
              <select
                id="quick-log-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                data-testid="quick-log-category"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="quick-log-description" className="block text-xs font-medium text-muted-foreground mb-1">
                簡述（選填）
              </label>
              <input
                id="quick-log-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例如：跟客戶開會討論驗收"
                maxLength={200}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="quick-log-description"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[10px] text-muted-foreground/70">
                ⌘/Ctrl + Enter 直接儲存
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                  className="px-3 py-1.5 text-xs rounded-md bg-muted hover:bg-muted/80 disabled:opacity-50"
                  data-testid="quick-log-cancel"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={submitting}
                  className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1.5"
                  data-testid="quick-log-save"
                >
                  {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                  儲存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
