"use client";

/**
 * DailyDigestBanner — Issue #963
 *
 * Displays at top of timesheet page: "今天有 N 筆工時建議待確認"
 * Fetches suggestions from GET /api/time-entries/suggestions
 * and allows batch confirmation via POST /api/time-entries/confirm-suggestions.
 */

import { useState, useEffect, useCallback } from "react";
import { Clock, Check, ChevronDown, ChevronUp, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Suggestion {
  id: string;
  taskId: string;
  taskTitle: string;
  type: "timer_start" | "time_entry";
  suggestedHours: number;
  date: string;
  startedAt: string | null;
  completedAt: string | null;
  category: string;
  alreadyLogged: boolean;
}

export function DailyDigestBanner() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/time-entries/suggestions");
      if (res.ok) {
        const body = await res.json();
        const items: Suggestion[] = body?.data ?? [];
        // Only show non-already-logged suggestions
        const pending = items.filter((s) => !s.alreadyLogged && s.suggestedHours > 0);
        setSuggestions(pending);
        // Default: select all
        setSelected(new Set(pending.map((s) => s.id)));
      }
    } catch {
      // Silently fail — banner is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmSelected = async () => {
    const toConfirm = suggestions.filter((s) => selected.has(s.id) && s.type === "time_entry");
    if (toConfirm.length === 0) return;

    setConfirming(true);
    try {
      const res = await fetch("/api/time-entries/confirm-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestions: toConfirm.map((s) => ({
            taskId: s.taskId,
            hours: s.suggestedHours,
            date: s.date,
            category: s.category,
          })),
        }),
      });
      if (res.ok) {
        // Remove confirmed from list
        setSuggestions((prev) => prev.filter((s) => !selected.has(s.id)));
        setSelected(new Set());
      }
    } catch {
      // Silent fail
    } finally {
      setConfirming(false);
    }
  };

  // Don't render if dismissed, loading, or no suggestions
  if (dismissed || loading || suggestions.length === 0) return null;

  const confirmableCount = suggestions.filter(
    (s) => selected.has(s.id) && s.type === "time_entry"
  ).length;

  return (
    <div className="border border-amber-500/30 bg-amber-500/5 rounded-xl overflow-hidden">
      {/* Summary bar */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <Clock className="h-4 w-4" />
          <span className="text-sm font-medium">
            今天有 {suggestions.length} 筆工時建議待確認
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {confirmableCount > 0 && (
            <button
              onClick={confirmSelected}
              disabled={confirming}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {confirming ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              確認 {confirmableCount} 筆
            </button>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-md hover:bg-amber-500/10 transition-colors text-amber-600 dark:text-amber-400"
            aria-label={expanded ? "收合" : "展開"}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-md hover:bg-amber-500/10 transition-colors text-muted-foreground"
            aria-label="關閉"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-amber-500/20 px-4 py-2 space-y-1">
          {suggestions.map((s) => (
            <label
              key={s.id}
              className={cn(
                "flex items-center gap-3 py-2 px-2 rounded-md hover:bg-amber-500/5 cursor-pointer transition-colors",
                selected.has(s.id) && "bg-amber-500/5"
              )}
            >
              <input
                type="checkbox"
                checked={selected.has(s.id)}
                onChange={() => toggleSelect(s.id)}
                className="rounded border-amber-400 text-amber-500 focus:ring-amber-500"
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-foreground truncate block">
                  {s.taskTitle}
                </span>
                <span className="text-xs text-muted-foreground">
                  {s.type === "time_entry"
                    ? `建議工時：${s.suggestedHours}h`
                    : "建議開始計時"}
                  {s.startedAt && (
                    <> · 開始：{new Date(s.startedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</>
                  )}
                  {s.completedAt && (
                    <> · 完成：{new Date(s.completedAt).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</>
                  )}
                </span>
              </div>
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 tabular-nums flex-shrink-0">
                {s.suggestedHours > 0 ? `${s.suggestedHours}h` : "—"}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
