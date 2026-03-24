"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Kanban, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskCard, type TaskCardData } from "@/app/components/task-card";
import { TaskFilters, type TaskFilters as FiltersType } from "@/app/components/task-filters";
import { TaskDetailModal } from "@/app/components/task-detail-modal";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";

type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: "BACKLOG", label: "待辦清單", color: "text-zinc-400" },
  { status: "TODO", label: "待處理", color: "text-blue-400" },
  { status: "IN_PROGRESS", label: "進行中", color: "text-yellow-400" },
  { status: "REVIEW", label: "審核中", color: "text-purple-400" },
  { status: "DONE", label: "已完成", color: "text-emerald-400" },
];

const columnBorder: Record<TaskStatus, string> = {
  BACKLOG: "border-zinc-700/50",
  TODO: "border-blue-500/20",
  IN_PROGRESS: "border-yellow-500/20",
  REVIEW: "border-purple-500/20",
  DONE: "border-emerald-500/20",
};

const columnHeaderBg: Record<TaskStatus, string> = {
  BACKLOG: "bg-zinc-800/60",
  TODO: "bg-blue-500/10",
  IN_PROGRESS: "bg-yellow-500/10",
  REVIEW: "bg-purple-500/10",
  DONE: "bg-emerald-500/10",
};

export default function KanbanPage() {
  const [tasks, setTasks] = useState<TaskCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FiltersType>({ assignee: "", priority: "", category: "" });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [movingTask, setMovingTask] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      if (filters.assignee) params.set("assignee", filters.assignee);
      if (filters.priority) params.set("priority", filters.priority);
      if (filters.category) params.set("category", filters.category);
      const res = await fetch(`/api/tasks?${params}`);
      if (!res.ok) throw new Error("任務載入失敗");
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  async function moveTask(taskId: string, newStatus: TaskStatus) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    setMovingTask(taskId);

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: task.status } : t));
      }
    } catch {
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: task.status } : t));
    } finally {
      setMovingTask(null);
    }
  }

  function handleDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.setData("taskId", taskId);
    setDraggingId(taskId);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOver(null);
  }

  function handleDragOver(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    setDragOver(status);
  }

  function handleDrop(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId) moveTask(taskId, status);
    setDragOver(null);
    setDraggingId(null);
  }

  const tasksByStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.04em]">看板</h1>
          <p className="text-muted-foreground text-sm mt-0.5">共 {tasks.length} 項任務</p>
        </div>
        <button className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md transition-colors border border-zinc-700">
          <Plus className="h-3.5 w-3.5" />
          新增任務
        </button>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0">
        <TaskFilters filters={filters} onChange={setFilters} />
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex-1">
          <PageLoading message="載入看板..." />
        </div>
      ) : fetchError ? (
        <div className="flex-1">
          <PageError message={fetchError} onRetry={fetchTasks} />
        </div>
      ) : tasks.length === 0 && !filters.assignee && !filters.priority && !filters.category ? (
        <div className="flex-1">
          <PageEmpty
            icon={<Kanban className="h-10 w-10" />}
            title="尚無任務"
            description="目前沒有任何任務，請點擊「新增任務」開始"
          />
        </div>
      ) : (
        <div className="flex-1 flex gap-3 overflow-x-auto pb-4 min-h-0">
          {COLUMNS.map(({ status, label, color }) => {
            const colTasks = tasksByStatus(status);
            const isOver = dragOver === status;
            return (
              <div
                key={status}
                className={cn(
                  "flex flex-col w-72 flex-shrink-0 rounded-xl border transition-colors",
                  columnBorder[status],
                  isOver && "ring-1 ring-zinc-500"
                )}
                onDragOver={(e) => handleDragOver(e, status)}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => handleDrop(e, status)}
              >
                {/* Column header */}
                <div className={cn("flex items-center justify-between px-3 py-2.5 rounded-t-xl", columnHeaderBg[status])}>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-semibold uppercase tracking-wider", color)}>
                      {label}
                    </span>
                    <span className="text-xs text-zinc-500 tabular-nums bg-zinc-800/60 px-1.5 py-0.5 rounded">
                      {colTasks.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "transition-opacity",
                        draggingId === task.id && "opacity-40"
                      )}
                    >
                      <TaskCard
                        task={task}
                        onClick={() => setSelectedTaskId(task.id)}
                        isDragging={draggingId === task.id}
                      />
                      {movingTask === task.id && (
                        <div className="flex justify-center py-1">
                          <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />
                        </div>
                      )}
                    </div>
                  ))}

                  {colTasks.length === 0 && (
                    <div
                      className={cn(
                        "flex items-center justify-center h-20 rounded-lg border border-dashed text-xs text-zinc-600 transition-colors",
                        isOver ? "border-zinc-500 bg-zinc-800/30 text-zinc-400" : "border-zinc-800"
                      )}
                    >
                      {isOver ? "放置到此欄" : "尚無任務"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task detail modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdated={() => {
            setSelectedTaskId(null);
            fetchTasks();
          }}
        />
      )}
    </div>
  );
}
