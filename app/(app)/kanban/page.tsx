"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Kanban, Loader2, CheckSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskCard, type TaskCardData } from "@/app/components/task-card";
import { TaskFilters, type TaskFilters as FiltersType } from "@/app/components/task-filters";
import { TaskDetailModal } from "@/app/components/task-detail-modal";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";

type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
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

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "BACKLOG", label: "待辦清單" },
  { value: "TODO", label: "待處理" },
  { value: "IN_PROGRESS", label: "進行中" },
  { value: "REVIEW", label: "審核中" },
  { value: "DONE", label: "已完成" },
];

const PRIORITY_OPTIONS = [
  { value: "P0", label: "P0" },
  { value: "P1", label: "P1" },
  { value: "P2", label: "P2" },
  { value: "P3", label: "P3" },
];

export default function KanbanPage() {
  const [tasks, setTasks] = useState<TaskCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FiltersType>({ assignee: "", priority: "", category: "" });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [movingTask, setMovingTask] = useState<string | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

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
      const json = await res.json();
      // Support paginated response { data: { items, pagination } } and legacy array
      const payload = json?.data ?? json;
      setTasks(Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : []);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Fetch users for assignee picker
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((json) => {
        const data = json?.data ?? json;
        const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        setUsers(list.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
      })
      .catch(() => {});
  }, []);

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

  // Bulk selection helpers
  function toggleSelect(taskId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function executeBulkAction(updates: Record<string, unknown>) {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch("/api/tasks/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskIds: [...selectedIds],
          updates,
        }),
      });
      if (res.ok) {
        clearSelection();
        await fetchTasks();
      }
    } finally {
      setBulkLoading(false);
    }
  }

  const tasksByStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);
  const hasSelection = selectedIds.size > 0;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">看板</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">共 {tasks.length} 項任務</p>
        </div>
        <button className="flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-primary text-primary-foreground rounded-lg shadow-sm transition-all hover:opacity-90 w-full sm:w-auto">
          <Plus className="h-3.5 w-3.5" />
          新增任務
        </button>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0">
        <TaskFilters filters={filters} onChange={setFilters} />
      </div>

      {/* Bulk action bar */}
      {hasSelection && (
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <CheckSquare className="h-4 w-4" />
            已選取 {selectedIds.size} 項
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Change status */}
          <select
            className="text-sm border border-border rounded-md px-2 py-1 bg-background"
            defaultValue=""
            disabled={bulkLoading}
            onChange={(e) => {
              if (e.target.value) {
                executeBulkAction({ status: e.target.value });
                e.target.value = "";
              }
            }}
          >
            <option value="" disabled>變更狀態</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Change priority */}
          <select
            className="text-sm border border-border rounded-md px-2 py-1 bg-background"
            defaultValue=""
            disabled={bulkLoading}
            onChange={(e) => {
              if (e.target.value) {
                executeBulkAction({ priority: e.target.value });
                e.target.value = "";
              }
            }}
          >
            <option value="" disabled>變更優先度</option>
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Change assignee */}
          <select
            className="text-sm border border-border rounded-md px-2 py-1 bg-background"
            defaultValue=""
            disabled={bulkLoading}
            onChange={(e) => {
              if (e.target.value) {
                const val = e.target.value === "__unassign__" ? null : e.target.value;
                executeBulkAction({ primaryAssigneeId: val });
                e.target.value = "";
              }
            }}
          >
            <option value="" disabled>變更負責人</option>
            <option value="__unassign__">取消指派</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          {bulkLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

          <button
            onClick={clearSelection}
            className="ml-auto p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="取消選取"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
        {/* Desktop: horizontal scroll board / Mobile: vertical stack */}
        <div
          className="flex-1 flex flex-col md:flex-row gap-3 overflow-y-auto md:overflow-x-auto md:overflow-y-hidden pb-4 min-h-0"
          tabIndex={0}
          role="region"
          aria-label="看板欄位"
        >
          {COLUMNS.map(({ status, label, color }) => {
            const colTasks = tasksByStatus(status);
            const isOver = dragOver === status;
            return (
              <div
                key={status}
                className={cn(
                  "flex flex-col rounded-xl border transition-colors",
                  // Mobile: full width, no shrink constraint; Desktop: fixed 288px column
                  "w-full md:w-72 md:flex-shrink-0",
                  columnBorder[status],
                  isOver && "ring-1 ring-ring"
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
                    <span className="text-xs text-muted-foreground tabular-nums bg-muted/60 px-1.5 py-0.5 rounded">
                      {colTasks.length}
                    </span>
                  </div>
                  {/* Mobile: status move buttons for touch */}
                  <span className="md:hidden text-[10px] text-muted-foreground">{colTasks.length} 項</span>
                </div>

                {/* Cards — on mobile, limit max-height to keep columns scannable */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px] max-h-[50vh] md:max-h-none md:min-h-[120px]">
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "transition-opacity relative group",
                        draggingId === task.id && "opacity-40"
                      )}
                    >
                      {/* Checkbox for bulk selection */}
                      <div
                        className={cn(
                          "absolute top-2 left-2 z-10",
                          hasSelection ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                          "transition-opacity"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(task.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelect(task.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-border text-primary cursor-pointer"
                          aria-label={`選取 ${task.title}`}
                        />
                      </div>
                      <div className={cn(selectedIds.has(task.id) && "ring-2 ring-primary/40 rounded-xl")}>
                        <TaskCard
                          task={task}
                          onClick={() => setSelectedTaskId(task.id)}
                          isDragging={draggingId === task.id}
                        />
                      </div>
                      {movingTask === task.id && (
                        <div className="flex justify-center py-1">
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ))}

                  {colTasks.length === 0 && (
                    <div
                      className={cn(
                        "flex items-center justify-center h-16 md:h-20 rounded-lg border border-dashed text-xs text-muted-foreground transition-colors",
                        isOver ? "border-ring bg-accent/30 text-foreground" : "border-border"
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
