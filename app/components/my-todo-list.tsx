"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardList, AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractItems } from "@/lib/api-client";
import { PageEmpty, PageError, SkeletonBar } from "@/app/components/page-states";
import { formatDate } from "@/lib/format";
import { TaskDetailModal } from "@/app/components/task-detail-modal";

// ── Types ──────────────────────────────────────────────────────────────────

interface TodoTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  tags: string[];
  primaryAssignee?: { id: string; name: string; avatar?: string | null } | null;
}

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  BACKLOG: { label: "待排", className: "bg-muted text-muted-foreground" },
  TODO: { label: "待辦", className: "bg-blue-500/10 text-blue-500" },
  IN_PROGRESS: { label: "進行中", className: "bg-yellow-500/10 text-yellow-500" },
  REVIEW: { label: "待審核", className: "bg-purple-500/10 text-purple-500" },
};

const PRIORITY_DOT: Record<string, string> = {
  P0: "bg-danger",
  P1: "bg-warning",
  P2: "bg-yellow-400",
  P3: "bg-muted-foreground",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function dueCountdownText(dueDate: string): { text: string; urgent: boolean } {
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: `逾期 ${Math.abs(diffDays)} 天`, urgent: true };
  if (diffDays === 0) return { text: "今天截止", urgent: true };
  if (diffDays === 1) return { text: "明天截止", urgent: true };
  if (diffDays <= 3) return { text: `${diffDays} 天後截止`, urgent: true };
  return { text: `${diffDays} 天後截止`, urgent: false };
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function TodoListSkeleton() {
  return (
    <div className="bg-card rounded-xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <SkeletonBar className="h-4 w-4" />
        <SkeletonBar className="h-4 w-24" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <SkeletonBar className="w-2 h-2 rounded-full" />
            <SkeletonBar className="flex-1 h-4" />
            <SkeletonBar className="w-12 h-4" />
            <SkeletonBar className="w-16 h-4" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

interface MyTodoListProps {
  /** 最多顯示幾筆，0 = 不限 */
  maxItems?: number;
}

export function MyTodoList({ maxItems = 0 }: MyTodoListProps) {
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const fetchTodos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        "/api/tasks?assignee=me&status=TODO,IN_PROGRESS,REVIEW&limit=50"
      );
      if (!res.ok) throw new Error("無法載入待辦任務");
      const body = await res.json();
      const all: TodoTask[] = extractItems<TodoTask>(body);

      // Sort by dueDate ascending; null dueDate goes last
      const withDue = all
        .filter((t) => t.dueDate)
        .sort(
          (a, b) =>
            new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
        );
      const withoutDue = all.filter((t) => !t.dueDate);
      const sorted = [...withDue, ...withoutDue];

      setTasks(maxItems > 0 ? sorted.slice(0, maxItems) : sorted);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [maxItems]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  if (loading) return <TodoListSkeleton />;
  if (error) return <PageError message={error} onRetry={fetchTodos} className="py-8" />;
  if (tasks.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-card p-5">
        <PageEmpty
          icon={<ClipboardList className="h-8 w-8" />}
          title="沒有待辦任務"
          description="目前沒有指派給您的未完成任務，做得好！"
          className="py-8"
        />
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-xl shadow-card p-5">
        <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          我的待辦
          <span className="text-xs text-muted-foreground font-normal">
            （共 {tasks.length} 項）
          </span>
        </h2>
        <div className="space-y-1">
          {tasks.map((t) => {
            const countdown = t.dueDate ? dueCountdownText(t.dueDate) : null;
            const badge = STATUS_BADGE[t.status];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTaskId(t.id)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent/60 transition-colors text-left group"
              >
                {/* Priority dot */}
                <span
                  className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    PRIORITY_DOT[t.priority] ?? "bg-muted-foreground"
                  )}
                />

                {/* Title */}
                <span className="flex-1 text-sm text-foreground truncate">
                  {t.title}
                </span>

                {/* Tags */}
                {t.tags?.length > 0 && (
                  <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                    {t.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Status badge */}
                {badge && (
                  <span
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0",
                      badge.className
                    )}
                  >
                    {badge.label}
                  </span>
                )}

                {/* Due date countdown */}
                {countdown ? (
                  <span
                    className={cn(
                      "text-[11px] tabular-nums flex-shrink-0 flex items-center gap-1",
                      countdown.urgent
                        ? "text-danger font-medium"
                        : "text-muted-foreground"
                    )}
                  >
                    {countdown.urgent && (
                      <AlertTriangle className="h-3 w-3" />
                    )}
                    {countdown.text}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground flex-shrink-0">
                    無截止日
                  </span>
                )}

                {/* Arrow */}
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground flex-shrink-0 transition-colors" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdated={fetchTodos}
        />
      )}
    </>
  );
}
