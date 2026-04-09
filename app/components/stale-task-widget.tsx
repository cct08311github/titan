"use client";

/**
 * StaleTaskWidget — Issue #1312
 *
 * Displays stale (inactive) tasks grouped by severity level:
 *   🔴 ESCALATE (>14 days)
 *   🟠 WARN     (7–14 days)
 *   🟡 REMIND   (3–7 days)
 *
 * Each task has a "標記為進行中" button that patches the task's status to
 * IN_PROGRESS, refreshing the widget afterward.
 */

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type StaleLevel = "REMIND" | "WARN" | "ESCALATE";

interface StaleTaskItem {
  id: string;
  title: string;
  level: StaleLevel;
  daysSinceUpdate: number;
  dueDate: string | null;
  assigneeName: string | null;
  status: string;
}

interface StaleTaskWidgetProps {
  role: "ADMIN" | "MANAGER" | "ENGINEER";
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LEVEL_LABELS: Record<StaleLevel, string> = {
  ESCALATE: "🔴 升級警示",
  WARN: "🟠 停滯警告",
  REMIND: "🟡 停滯提醒",
};

const LEVEL_COLORS: Record<StaleLevel, string> = {
  ESCALATE: "text-red-600 dark:text-red-400",
  WARN: "text-orange-600 dark:text-orange-400",
  REMIND: "text-yellow-600 dark:text-yellow-500",
};

const LEVEL_BG: Record<StaleLevel, string> = {
  ESCALATE:
    "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
  WARN: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800",
  REMIND:
    "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800",
};

const LEVEL_ORDER: StaleLevel[] = ["ESCALATE", "WARN", "REMIND"];

// ── Sub-components ────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse bg-muted rounded", className)} />
  );
}

function LoadingSkeleton() {
  return (
    <div
      className="bg-card rounded-xl shadow-card p-5 space-y-3"
      aria-busy="true"
      aria-label="載入停滯任務中"
    >
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

interface TaskRowProps {
  task: StaleTaskItem;
  showAssignee: boolean;
  onMarkInProgress: (id: string) => Promise<void>;
  markingId: string | null;
}

function TaskRow({ task, showAssignee, onMarkInProgress, markingId }: TaskRowProps) {
  const isMarking = markingId === task.id;

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-2 p-2.5 rounded-md border text-sm",
        LEVEL_BG[task.level]
      )}
    >
      <a
        href={`/kanban?taskId=${task.id}`}
        className="flex-1 min-w-0 group"
        aria-label={`前往任務：${task.title}`}
      >
        <div className="font-medium truncate group-hover:underline">{task.title}</div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
          <span>停滯 {task.daysSinceUpdate} 天</span>
          {showAssignee && task.assigneeName && (
            <span>· {task.assigneeName}</span>
          )}
          {task.dueDate && (
            <span>
              · 截止{" "}
              {new Date(task.dueDate).toLocaleDateString("zh-TW", {
                month: "numeric",
                day: "numeric",
              })}
            </span>
          )}
        </div>
      </a>

      <button
        onClick={() => onMarkInProgress(task.id)}
        disabled={isMarking}
        className={cn(
          "flex-shrink-0 text-xs px-2 py-1 rounded border transition-colors",
          "border-muted-foreground/30 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary",
          isMarking && "opacity-50 cursor-not-allowed"
        )}
        aria-label={`將任務「${task.title}」標記為進行中`}
      >
        {isMarking ? "處理中…" : "進行中"}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function StaleTaskWidget({ role }: StaleTaskWidgetProps) {
  const [tasks, setTasks] = useState<StaleTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const showAssignee = role !== "ENGINEER";

  const fetchStaleTasks = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/tasks/stale");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `請求失敗 (${res.status})`);
      }
      const body = await res.json();
      setTasks(body?.data?.tasks ?? []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaleTasks();
  }, [fetchStaleTasks]);

  const handleMarkInProgress = useCallback(
    async (taskId: string) => {
      setMarkingId(taskId);
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "IN_PROGRESS" }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message ?? "更新失敗");
        }
        toast.success("任務已更新為進行中");
        // Refresh widget after status change
        await fetchStaleTasks();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "更新任務失敗，請稍後再試");
      } finally {
        setMarkingId(null);
      }
    },
    [fetchStaleTasks]
  );

  if (loading) return <LoadingSkeleton />;

  // Group tasks by level
  const grouped = LEVEL_ORDER.reduce<Record<StaleLevel, StaleTaskItem[]>>(
    (acc, lvl) => {
      acc[lvl] = tasks.filter((t) => t.level === lvl);
      return acc;
    },
    { ESCALATE: [], WARN: [], REMIND: [] }
  );

  return (
    <section
      className="bg-card rounded-xl shadow-card p-5"
      aria-label="停滯工作提醒"
    >
      <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
        ⚠️ 停滯工作提醒
      </h2>

      {fetchError ? (
        <div className="py-4 text-center space-y-2">
          <p className="text-sm text-red-500 dark:text-red-400">{fetchError}</p>
          <button
            onClick={fetchStaleTasks}
            className="text-xs underline text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded"
            aria-label="重新載入停滯工作"
          >
            重試
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2 text-center">
          目前沒有停滯任務 ✅
        </p>
      ) : (
        <div className="space-y-4">
          {LEVEL_ORDER.map((level) => {
            const levelTasks = grouped[level];
            if (levelTasks.length === 0) return null;
            return (
              <div key={level}>
                <h3
                  className={cn(
                    "text-xs font-semibold mb-2 uppercase tracking-wide",
                    LEVEL_COLORS[level]
                  )}
                >
                  {LEVEL_LABELS[level]}
                  <span className="ml-1 font-normal normal-case tracking-normal opacity-70">
                    ({levelTasks.length})
                  </span>
                </h3>
                <div className="space-y-1.5">
                  {levelTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      showAssignee={showAssignee}
                      onMarkInProgress={handleMarkInProgress}
                      markingId={markingId}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
