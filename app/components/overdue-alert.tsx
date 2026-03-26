"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, ChevronRight, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractItems } from "@/lib/api-client";
import { SkeletonBar, PageError } from "@/app/components/page-states";
import { TaskDetailModal } from "@/app/components/task-detail-modal";
import { isOverdue, overdueDays } from "@/lib/utils/overdue";
import { useSession } from "next-auth/react";

// ── Types ──────────────────────────────────────────────────────────────────

interface OverdueTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  primaryAssignee?: { id: string; name: string; avatar?: string | null } | null;
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function OverdueSkeleton() {
  return (
    <div className="border border-danger/30 bg-danger/5 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <SkeletonBar className="h-4 w-4" />
        <SkeletonBar className="h-4 w-24" />
        <SkeletonBar className="h-5 w-5 rounded-full" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <SkeletonBar className="flex-1 h-4" />
            <SkeletonBar className="w-20 h-4" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function OverdueAlert() {
  const { data: session } = useSession();
  const isManager = session?.user?.role === "MANAGER" || session?.user?.role === "ADMIN";

  const [tasks, setTasks] = useState<OverdueTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const fetchOverdue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Manager sees all team tasks; Engineer sees own only
      const assigneeParam = isManager ? "" : "assignee=me&";
      const res = await fetch(
        `/api/tasks?${assigneeParam}status=BACKLOG,TODO,IN_PROGRESS,REVIEW&limit=100`
      );
      if (!res.ok) throw new Error("無法載入逾期任務");
      const body = await res.json();
      const all: OverdueTask[] = extractItems<OverdueTask>(body);

      // Filter to overdue only, sort by overdue days descending
      const overdue = all
        .filter((t) => isOverdue(t.dueDate, t.status))
        .sort((a, b) => overdueDays(b.dueDate, b.status) - overdueDays(a.dueDate, a.status));

      setTasks(overdue);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [isManager]);

  useEffect(() => {
    fetchOverdue();
  }, [fetchOverdue]);

  if (loading) return <OverdueSkeleton />;
  if (error) return <PageError message={error} onRetry={fetchOverdue} className="py-4" />;
  if (tasks.length === 0) return null; // No overdue = no alert shown

  return (
    <>
      <div className="border border-danger/30 bg-danger/5 rounded-xl p-5">
        {/* Header with overdue count badge */}
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-4 w-4 text-danger" />
          <h2 className="text-sm font-medium text-danger">逾期任務警示</h2>
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-danger text-white text-[11px] font-bold">
            {tasks.length}
          </span>
          {isManager && (
            <span className="text-[10px] text-muted-foreground ml-1">（團隊全部）</span>
          )}
        </div>

        {/* Overdue task list — sorted by overdue days desc */}
        <div className="space-y-1">
          {tasks.map((t) => {
            const days = overdueDays(t.dueDate, t.status);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTaskId(t.id)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-danger/5 hover:bg-danger/10 transition-colors text-left group"
              >
                {/* Overdue days */}
                <span className="text-xs font-bold text-danger tabular-nums flex-shrink-0 w-16">
                  逾期 {days} 天
                </span>

                {/* Title */}
                <span className="flex-1 text-sm text-foreground truncate">
                  {t.title}
                </span>

                {/* Assignee (for Manager view) */}
                {isManager && t.primaryAssignee && (
                  <span className="text-[11px] text-muted-foreground flex-shrink-0">
                    {t.primaryAssignee.name}
                  </span>
                )}

                {/* Due date */}
                <span className="text-[11px] text-danger tabular-nums flex-shrink-0">
                  {t.dueDate
                    ? new Date(t.dueDate).toLocaleDateString("zh-TW", {
                        month: "numeric",
                        day: "numeric",
                      })
                    : ""}
                </span>

                <ChevronRight className="h-3.5 w-3.5 text-danger/40 group-hover:text-danger flex-shrink-0 transition-colors" />
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
          onUpdated={fetchOverdue}
        />
      )}
    </>
  );
}
