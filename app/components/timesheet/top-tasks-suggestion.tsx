"use client";

/**
 * TopTasksSuggestion — Issue #1539-4 (from #1538 audit)
 *
 * Pulls the user's top 5 most-frequent tasks over the last 14 days and
 * renders them as one-click chips. Solves the Monday-morning recall problem:
 * "我上週做了什麼？" Now: a glance at this row tells you and lets you log
 * 1h with a single click.
 *
 * Design:
 * - Collapsible: shows compact "💡 你最常做的事" header by default
 * - Expanded: 5 chips with task title + last-week hours + quick "+1h 今天"
 * - Empty state: hidden entirely (no clutter when user is brand new)
 * - Failure: silent (toast only), don't block the page
 */
import { useState, useEffect, useCallback } from "react";
import { Lightbulb, Plus, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatLocalDate } from "@/lib/utils/date";
import { extractData } from "@/lib/api-client";
import { safeFixed } from "@/lib/safe-number";

interface TopTask {
  taskId: string;
  taskTitle: string;
  category: string;
  totalHours: number;
  entryCount: number;
  avgHoursPerEntry: number;
  lastEntryDate: string;
}

interface TopTasksResponse {
  items: TopTask[];
  windowDays: number;
}

interface TopTasksSuggestionProps {
  /** Called after a quick-log succeeds so parent can refresh the timesheet */
  onLogged: () => void;
  /** Save handler from useTimesheet — wired through page.tsx */
  onSave: (taskId: string, date: string, hours: number, category: string) => Promise<void>;
}

const STORAGE_KEY = "titan:topTasks:expanded";

function mapCategory(taskCategory: string): string {
  const map: Record<string, string> = {
    PLANNED: "PLANNED_TASK",
    ADDED: "ADDED_TASK",
    INCIDENT: "INCIDENT",
    SUPPORT: "SUPPORT",
    ADMIN: "ADMIN",
    LEARNING: "LEARNING",
  };
  return map[taskCategory] ?? "PLANNED_TASK";
}

export function TopTasksSuggestion({ onLogged, onSave }: TopTasksSuggestionProps) {
  const [tasks, setTasks] = useState<TopTask[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);

  // Restore last expanded state
  useEffect(() => {
    if (typeof window === "undefined") return;
    setExpanded(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  // Fetch on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/time-entries/top-tasks?days=14&limit=5")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fetch failed"))))
      .then((body) => {
        if (cancelled) return;
        const data = extractData<TopTasksResponse>(body);
        setTasks(data?.items ?? []);
      })
      .catch(() => {
        // Silent — this is a nice-to-have, not core
        if (!cancelled) setTasks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    }
  }

  const handleQuickLog = useCallback(async (task: TopTask) => {
    setSavingTaskId(task.taskId);
    const today = formatLocalDate(new Date());
    try {
      await onSave(task.taskId, today, 1, mapCategory(task.category));
      toast.success(`已記錄 1h — ${task.taskTitle}`);
      onLogged();
    } catch (e) {
      toast.error("快速記錄失敗，請稍後再試");
      console.error("[top-tasks] quick log failed", e);
    } finally {
      setSavingTaskId(null);
    }
  }, [onSave, onLogged]);

  // Hide entirely if loading first time or no tasks (avoid empty-state clutter)
  if (loading || tasks.length === 0) return null;

  return (
    <div className="border border-border rounded-lg bg-muted/20" data-testid="top-tasks-suggestion">
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={expanded}
        data-testid="top-tasks-toggle"
      >
        <span className="flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
          你最常做的事 (近 14 天)
          <span className="text-[10px] text-muted-foreground/70">— {tasks.length} 個任務</span>
        </span>
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-1.5" data-testid="top-tasks-list">
          {tasks.map((task) => {
            const saving = savingTaskId === task.taskId;
            return (
              <div
                key={task.taskId}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-card border border-border/50 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{task.taskTitle}</div>
                  <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                    14 天累計 {safeFixed(task.totalHours, 1)}h · {task.entryCount} 筆 · 平均 {safeFixed(task.avgHoursPerEntry, 1)}h/筆
                  </div>
                </div>
                <button
                  onClick={() => handleQuickLog(task)}
                  disabled={saving}
                  className={cn(
                    "flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors disabled:opacity-50",
                    "bg-primary/10 text-primary hover:bg-primary/20",
                  )}
                  data-testid={`top-tasks-log-${task.taskId}`}
                  aria-label={`快速記 1 小時到 ${task.taskTitle}`}
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  +1h 今天
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
