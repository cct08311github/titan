"use client";

/**
 * Unified Workspace Page — Issue #961
 *
 * Single page with view switcher: 看板 | 甘特 | 列表
 * All views share the same WorkspaceContext (task data + filters).
 */

import { useState } from "react";
import { KanbanSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WorkspaceShell,
  ConnectedViewSwitcher,
  useWorkspace,
} from "@/app/components/workspace/workspace-context";
import { WorkspaceFilterBar } from "@/app/components/workspace-filters";
import { WorkspaceTableView } from "@/app/components/workspace-table-view";
import { TaskDetailModal } from "@/app/components/task-detail-modal";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";
import { KanbanColumn } from "@/app/components/kanban-column";
import { type TaskCardData } from "@/app/components/task-card";

// ─── Kanban Constants (from original kanban page) ────────────────────────────

type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
const COLUMN_ORDER: TaskStatus[] = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"];

const DEFAULT_COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: "BACKLOG", label: "待辦清單", color: "text-muted-foreground" },
  { status: "TODO", label: "待處理", color: "text-blue-400" },
  { status: "IN_PROGRESS", label: "進行中", color: "text-yellow-400" },
  { status: "REVIEW", label: "審核中", color: "text-purple-400" },
  { status: "DONE", label: "已完成", color: "text-emerald-400" },
];

const columnBorder: Record<TaskStatus, string> = {
  BACKLOG: "border-border",
  TODO: "border-blue-500/20",
  IN_PROGRESS: "border-yellow-500/20",
  REVIEW: "border-purple-500/20",
  DONE: "border-emerald-500/20",
};

const columnHeaderBg: Record<TaskStatus, string> = {
  BACKLOG: "bg-muted/60",
  TODO: "bg-blue-500/10",
  IN_PROGRESS: "bg-yellow-500/10",
  REVIEW: "bg-purple-500/10",
  DONE: "bg-emerald-500/10",
};

// ─── Inner Content (uses workspace context) ──────────────────────────────────

function WorkspaceContent() {
  const ws = useWorkspace();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Kanban-specific state
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [movingTask, setMovingTask] = useState<string | null>(null);

  // ── Kanban helpers ─────────────────────────────────────────────────────────

  const tasksByStatus = (status: TaskStatus) =>
    (ws.tasks as (TaskCardData & { position?: number })[])
      .filter((t) => t.status === status)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  async function moveTask(taskId: string, newStatus: TaskStatus, targetIndex?: number) {
    const task = ws.tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) ws.refresh();
    } catch {
      // Silent fail — refresh to restore
      ws.refresh();
    }
  }

  function handleDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(taskId);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOver(null);
  }

  function handleDragOver(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(status);
  }

  function handleDragLeave() {
    setDragOver(null);
  }

  function handleDrop(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId) moveTask(taskId, status);
    setDragOver(null);
    setDraggingId(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">工作空間</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            共 {ws.tasks.length} 項任務
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View switcher — Issue #961 */}
          <ConnectedViewSwitcher />

          {/* Add task */}
          <button
            onClick={async () => {
              const title = prompt("任務標題：");
              if (!title?.trim()) return;
              const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: title.trim(),
                  status: "BACKLOG",
                  priority: "P2",
                  category: "PLANNED",
                }),
              });
              if (res.ok) ws.refresh();
              else {
                const errBody = await res.json().catch(() => ({}));
                alert(errBody?.message ?? errBody?.error ?? "建立失敗");
              }
            }}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-primary text-primary-foreground rounded-lg shadow-sm transition-all hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            新增任務
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0">
        <WorkspaceFilterBar />
      </div>

      {/* Content */}
      {ws.loading ? (
        <div className="flex-1">
          <PageLoading message="載入工作空間..." />
        </div>
      ) : ws.fetchError ? (
        <div className="flex-1">
          <PageError message={ws.fetchError} onRetry={ws.refresh} />
        </div>
      ) : ws.tasks.length === 0 && !ws.hasActiveFilters ? (
        <div className="flex-1">
          <PageEmpty
            icon={<KanbanSquare className="h-10 w-10" />}
            title="尚無任務"
            description="目前沒有任何任務，請點擊「新增任務」開始"
          />
        </div>
      ) : (
        <>
          {/* ── Kanban View ── */}
          {ws.viewMode === "kanban" && (
            <div
              className="flex-1 flex flex-col md:flex-row gap-3 overflow-y-auto md:overflow-x-auto md:overflow-y-hidden pb-4 min-h-0"
              role="region"
              aria-label="看板欄位"
            >
              {DEFAULT_COLUMNS.map(({ status, label, color }) => (
                <div key={status} className="group/col">
                  <KanbanColumn
                    status={status}
                    label={label}
                    color={color}
                    borderClass={columnBorder[status]}
                    headerBgClass={columnHeaderBg[status]}
                    tasks={tasksByStatus(status)}
                    draggingId={draggingId}
                    isDragOver={dragOver === status}
                    movingTaskId={movingTask}
                    selectedIds={new Set()}
                    hasSelection={false}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onTaskClick={setSelectedTaskId}
                    onToggleSelect={() => {}}
                    onKeyboardMove={() => {}}
                    onKeyboardReorder={() => {}}
                  />
                </div>
              ))}
            </div>
          )}

          {/* ── Gantt View ── */}
          {ws.viewMode === "gantt" && (
            <div className="flex-1 overflow-auto border border-border rounded-xl bg-card p-4">
              <GanttMiniView tasks={ws.tasks} onTaskClick={setSelectedTaskId} />
            </div>
          )}

          {/* ── List View ── */}
          {ws.viewMode === "list" && (
            <div className="flex-1 min-h-0">
              <WorkspaceTableView tasks={ws.tasks} onTaskClick={setSelectedTaskId} />
            </div>
          )}
        </>
      )}

      {/* Task detail modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdated={() => {
            setSelectedTaskId(null);
            ws.refresh();
          }}
        />
      )}
    </div>
  );
}

// ─── Simple Gantt Mini View ──────────────────────────────────────────────────

const STATUS_BAR: Record<string, string> = {
  BACKLOG: "bg-muted",
  TODO: "bg-blue-500/70",
  IN_PROGRESS: "bg-warning/80",
  REVIEW: "bg-purple-500/80",
  DONE: "bg-emerald-500/80",
};

function GanttMiniView({
  tasks,
  onTaskClick,
}: {
  tasks: TaskCardData[];
  onTaskClick: (id: string) => void;
}) {
  const now = new Date();
  const year = now.getFullYear();
  const daysInYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;

  function dayOfYear(dateStr: string): number {
    const d = new Date(dateStr);
    const start = new Date(year, 0, 1);
    return Math.floor((d.getTime() - start.getTime()) / 86400000);
  }

  const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

  return (
    <div className="min-w-[700px]">
      {/* Month header */}
      <div className="flex border-b border-border mb-2">
        {MONTHS.map((m, i) => {
          const widthPct = (new Date(year, i + 1, 0).getDate() / daysInYear) * 100;
          return (
            <div
              key={i}
              className="text-center text-xs text-muted-foreground py-1.5 border-r border-border/50 last:border-0"
              style={{ width: `${widthPct}%` }}
            >
              {m}
            </div>
          );
        })}
      </div>

      {/* Task rows */}
      {tasks.map((task) => {
        const t = task as TaskCardData & { startDate?: string | null; dueDate?: string | null };
        if (!t.startDate && !t.dueDate) return null;

        const startDay = t.startDate
          ? Math.max(0, dayOfYear(t.startDate))
          : t.dueDate
          ? Math.max(0, dayOfYear(t.dueDate) - 7)
          : 0;
        const endDay = t.dueDate
          ? Math.min(daysInYear, dayOfYear(t.dueDate))
          : Math.min(daysInYear, startDay + 7);

        const leftPct = (startDay / daysInYear) * 100;
        const widthPct = Math.max(0.3, ((endDay - startDay) / daysInYear) * 100);

        return (
          <div
            key={task.id}
            className="flex items-center border-b border-border/20 hover:bg-accent/20 transition-colors cursor-pointer h-7"
            onClick={() => onTaskClick(task.id)}
          >
            <div className="w-40 flex-shrink-0 px-2 truncate text-xs text-muted-foreground">
              {task.title}
            </div>
            <div className="flex-1 relative h-4">
              <div
                className={cn("absolute h-4 rounded-sm", STATUS_BAR[task.status] ?? "bg-muted")}
                style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: "4px" }}
                title={task.title}
              >
                {widthPct > 5 && (
                  <span className="text-[9px] text-white/80 font-medium truncate leading-none px-1">
                    {task.title}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {tasks.filter((t) => {
        const tt = t as TaskCardData & { startDate?: string | null; dueDate?: string | null };
        return tt.startDate || tt.dueDate;
      }).length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">
          所有任務都沒有設定日期，無法顯示甘特圖
        </div>
      )}
    </div>
  );
}

// ─── Page (wrapped with WorkspaceShell — Issue #961) ─────────────────────────

export default function WorkPage() {
  return (
    <WorkspaceShell>
      <WorkspaceContent />
    </WorkspaceShell>
  );
}
