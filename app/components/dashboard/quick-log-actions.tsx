"use client";

/**
 * Quick-Log Actions — Issue #1470
 *
 * Adds actionable buttons to Engineer My Day cards so engineers can
 * start timers and apply time suggestions without leaving the dashboard.
 *
 * Three injection points:
 * 1. StartTimerButton — shown when todayHours === 0 (or standalone)
 * 2. ApplySuggestionButton — per timeSuggestion row
 * 3. TaskTimerButton — per in-progress task row (hover reveal)
 */
import { useState, useCallback } from "react";
import { Play, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";

// ── Types ───────────────────────────────────────────────────────────────

interface TimeSuggestion {
  taskId: string;
  title: string;
  estimatedHours: number | null;
  suggestion: string;
}

// ── Start Timer Button ──────────────────────────────────────────────────

interface StartTimerButtonProps {
  /** Optional task ID to bind the timer to */
  taskId?: string;
  /** Compact mode for inline task row usage */
  compact?: boolean;
  /** Called after successful start so parent can refetch data */
  onSuccess: () => void;
}

export function StartTimerButton({ taskId, compact, onSuccess }: StartTimerButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleStart = useCallback(async () => {
    setLoading(true);
    const body: Record<string, string> = {};
    if (taskId) body.taskId = taskId;

    const { error, status } = await apiFetch("/api/time-entries/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (error) {
      if (status === 409) {
        toast.error("已有正在計時的項目，請先停止目前計時器");
      } else {
        // Don't forward the raw server error — can leak Prisma/stack detail.
        toast.error("無法啟動計時器，請稍後再試");
        console.error("[quick-log] start timer failed", { status, error });
      }
      return;
    }

    toast.success("計時器已啟動");
    onSuccess();
  }, [taskId, onSuccess]);

  if (compact) {
    return (
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleStart(); }}
        disabled={loading}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 text-primary disabled:opacity-50 flex-shrink-0"
        title="開始計時"
        data-testid="task-timer-btn"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
      </button>
    );
  }

  return (
    <button
      onClick={handleStart}
      disabled={loading}
      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      data-testid="start-timer-btn"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
      開始計時
    </button>
  );
}

// ── Apply Suggestion Button ─────────────────────────────────────────────

interface ApplySuggestionButtonProps {
  suggestion: TimeSuggestion;
  onSuccess: () => void;
}

export function ApplySuggestionButton({ suggestion, onSuccess }: ApplySuggestionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);

  const handleApply = useCallback(async () => {
    setLoading(true);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { error } = await apiFetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: suggestion.taskId,
        hours: suggestion.estimatedHours ?? 1,
        date: today.toISOString(),
        category: "PLANNED_TASK",
        description: `自動套用建議：${suggestion.title}`,
      }),
    });

    setLoading(false);

    if (error) {
      // Don't forward the raw server error — can leak Prisma/stack detail.
      toast.error("套用建議失敗，請稍後再試");
      console.error("[quick-log] apply suggestion failed", { error });
      return;
    }

    setApplied(true);
    toast.success(`已記錄 ${suggestion.estimatedHours ?? 1}h — ${suggestion.title}`);
    onSuccess();
  }, [suggestion, onSuccess]);

  return (
    <button
      onClick={handleApply}
      disabled={loading || applied}
      className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-900/60"
      data-testid="apply-suggestion-btn"
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : applied ? (
        <Check className="h-3 w-3" />
      ) : (
        <Check className="h-3 w-3" />
      )}
      {applied ? "已套用" : "套用"}
    </button>
  );
}
