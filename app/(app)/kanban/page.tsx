"use client";

/**
 * Kanban Page — Issue #803 (K-1)
 *
 * Features:
 * - Drag-and-drop between columns with optimistic update + rollback
 * - Same-column reordering (position-based)
 * - Custom column names (persisted in localStorage)
 * - Keyboard navigation (Tab, Enter, Arrow keys)
 * - Visual drag feedback (drop indicators, column highlight)
 * - Activity log integration via API
 * - Multi-select mode with batch operations (Issue #1023)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Kanban,
  Loader2,
  CheckSquare,
  X,
  MousePointerSquareDashed,
  Check,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { extractItems } from "@/lib/api-client";
import { type TaskCardData } from "@/app/components/task-card";
import {
  TaskFilters,
  type TaskFilters as FiltersType,
  emptyFilters,
  hasActiveFilters,
  parseFiltersFromUrl,
} from "@/app/components/task-filters";
import { TaskDetailModal } from "@/app/components/task-detail-modal";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";
import { KanbanColumn } from "@/app/components/kanban-column";
import { calculatePosition } from "@/lib/utils/optimistic-update";

type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

const COLUMN_ORDER: TaskStatus[] = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
];

const DEFAULT_COLUMNS: { status: TaskStatus; label: string; color: string }[] =
  [
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

const COLUMN_NAMES_KEY = "titan-kanban-column-names";

function loadColumnNames(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(COLUMN_NAMES_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveColumnNames(names: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COLUMN_NAMES_KEY, JSON.stringify(names));
  } catch {
    // Ignore storage errors
  }
}

export default function KanbanPage() {
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<
    (TaskCardData & { position?: number })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [allTasks, setAllTasks] = useState<
    (TaskCardData & { position?: number })[]
  >([]);
  const [filters, setFilters] = useState<FiltersType>(() =>
    parseFiltersFromUrl(new URLSearchParams(searchParams.toString()))
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showDragHint, setShowDragHint] = useState(false);

  // Issue #1231: auto-open task detail modal from URL ?task= parameter
  useEffect(() => {
    const taskParam = searchParams.get("task");
    if (taskParam) {
      setSelectedTaskId(taskParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("titan-kanban-onboarded")) {
      setShowDragHint(true);
    }
  }, []);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [movingTask, setMovingTask] = useState<string | null>(null);
  const [columnNames, setColumnNames] = useState<Record<string, string>>({});

  // Bulk selection state (Issue #1023)
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkToast, setBulkToast] = useState<{
    type: "success" | "error" | "partial";
    message: string;
  } | null>(null);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  // Project filter state (Issue #1176)
  const [projectFilter, setProjectFilter] = useState("");
  const [projectOptions, setProjectOptions] = useState<{ id: string; code: string; name: string }[]>([]);

  // Ref to always access latest tasks (avoids stale closures in keyboard handlers)
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  // Snapshot for rollback
  const tasksSnapshot = useRef<(TaskCardData & { position?: number })[]>([]);

  // Load custom column names from localStorage
  useEffect(() => {
    setColumnNames(loadColumnNames());
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      if (filters.assignee) params.set("assignee", filters.assignee);
      if (filters.priority) params.set("priority", filters.priority);
      if (filters.category) params.set("category", filters.category);
      if (projectFilter) params.set("projectId", projectFilter);
      const res = await fetch(`/api/tasks?${params}`);
      if (!res.ok) throw new Error("任務載入失敗");
      const body = await res.json();
      const fetched = extractItems<
        TaskCardData & {
          position?: number;
          tags?: string[];
          dueDate?: string | null;
        }
      >(body);
      setAllTasks(fetched);

      // Client-side AND filtering for tags and dueDate range
      let filtered = fetched;
      if (filters.tags.length > 0) {
        filtered = filtered.filter((t) =>
          filters.tags.every((tag) =>
            (t as unknown as { tags?: string[] }).tags?.includes(tag)
          )
        );
      }
      if (filters.dueDateFrom) {
        filtered = filtered.filter((t) => {
          const due = (t as unknown as { dueDate?: string | null }).dueDate;
          return due && due.split("T")[0] >= filters.dueDateFrom;
        });
      }
      if (filters.dueDateTo) {
        filtered = filtered.filter((t) => {
          const due = (t as unknown as { dueDate?: string | null }).dueDate;
          return due && due.split("T")[0] <= filters.dueDateTo;
        });
      }
      setTasks(filtered);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [filters, projectFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Fetch users for assignee picker
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((body) => {
        const list = extractItems<{ id: string; name: string }>(body);
        setUsers(list.map((u) => ({ id: u.id, name: u.name })));
      })
      .catch(() => {});
    // Fetch project options for filter (Issue #1176)
    fetch("/api/projects?limit=100")
      .then((r) => r.json())
      .then((body) => {
        const data = body?.data ?? body;
        const items = data?.items ?? [];
        setProjectOptions(items.map((p: { id: string; code: string; name: string }) => ({ id: p.id, code: p.code, name: p.name })));
      })
      .catch(() => {});
  }, []);

  // ── Column name management ──────────────────────────────────────────────

  const handleColumnNameChange = useCallback(
    (status: TaskStatus, name: string) => {
      setColumnNames((prev) => {
        const next = { ...prev, [status]: name };
        saveColumnNames(next);
        return next;
      });
    },
    []
  );

  // ── Move task between columns (optimistic) ─────────────────────────────

  async function moveTask(
    taskId: string,
    newStatus: TaskStatus,
    targetIndex?: number
  ) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) {
      // Same column reorder
      if (task && targetIndex !== undefined) {
        await reorderInColumn(taskId, task.status as TaskStatus, targetIndex);
      }
      return;
    }

    // Snapshot for rollback
    tasksSnapshot.current = [...tasks];

    // Calculate position for insertion
    const columnTasks = tasks
      .filter((t) => t.status === newStatus && t.id !== taskId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const insertIdx = targetIndex ?? columnTasks.length;
    const prevPos =
      insertIdx > 0 ? (columnTasks[insertIdx - 1]?.position ?? 0) : null;
    const nextPos =
      insertIdx < columnTasks.length
        ? (columnTasks[insertIdx]?.position ?? 0)
        : null;
    const newPosition = calculatePosition(prevPos, nextPos);

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: newStatus as TaskCardData["status"],
              position: newPosition,
            }
          : t
      )
    );
    setMovingTask(taskId);

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        // Rollback
        setTasks(tasksSnapshot.current);
        toast.error("任務更新失敗");
      } else {
        // Also update position via reorder API
        const reorderRes = await fetch("/api/tasks/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [{ id: taskId, position: newPosition, status: newStatus }],
          }),
        });
        if (reorderRes.ok) {
          toast.success("任務已更新");
        } else {
          toast.error("任務排序更新失敗");
        }
      }
    } catch {
      setTasks(tasksSnapshot.current);
      toast.error("任務更新失敗");
    } finally {
      setMovingTask(null);
    }
  }

  // ── Reorder within same column ────────────────────────────────────────

  async function reorderInColumn(
    taskId: string,
    status: TaskStatus,
    targetIndex: number
  ) {
    const columnTasks = tasks
      .filter((t) => t.status === status)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const currentIndex = columnTasks.findIndex((t) => t.id === taskId);
    if (currentIndex === targetIndex || currentIndex === -1) return;

    // Calculate new position
    const filtered = columnTasks.filter((t) => t.id !== taskId);
    const prevPos =
      targetIndex > 0 ? (filtered[targetIndex - 1]?.position ?? 0) : null;
    const nextPos =
      targetIndex < filtered.length
        ? (filtered[targetIndex]?.position ?? 0)
        : null;
    const newPosition = calculatePosition(prevPos, nextPos);

    // Snapshot for rollback
    tasksSnapshot.current = [...tasks];

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, position: newPosition } : t))
    );

    try {
      await fetch("/api/tasks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ id: taskId, position: newPosition }],
        }),
      });
    } catch {
      setTasks(tasksSnapshot.current);
    }
  }

  // ── Drag & drop handlers ──────────────────────────────────────────────

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
    if (taskId) {
      // Calculate target index from drop position
      const container = e.currentTarget as HTMLElement;
      const cards = container.querySelectorAll("[data-task-id]");
      let targetIdx = tasks.filter((t) => t.status === status).length;
      for (let i = 0; i < cards.length; i++) {
        const rect = cards[i].getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          targetIdx = i;
          break;
        }
      }
      moveTask(taskId, status, targetIdx);
    }
    setDragOver(null);
    setDraggingId(null);
  }

  // ── Keyboard navigation ───────────────────────────────────────────────

  const handleKeyboardMove = useCallback(
    (taskId: string, direction: "left" | "right") => {
      const currentTasks = tasksRef.current;
      const task = currentTasks.find((t) => t.id === taskId);
      if (!task) return;

      const currentIdx = COLUMN_ORDER.indexOf(task.status as TaskStatus);
      const newIdx = direction === "left" ? currentIdx - 1 : currentIdx + 1;
      if (newIdx < 0 || newIdx >= COLUMN_ORDER.length) return;

      const newStatus = COLUMN_ORDER[newIdx];
      moveTask(taskId, newStatus);
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleKeyboardReorder = useCallback(
    (taskId: string, direction: "up" | "down") => {
      const currentTasks = tasksRef.current;
      const task = currentTasks.find((t) => t.id === taskId);
      if (!task) return;

      const columnTasks = currentTasks
        .filter((t) => t.status === task.status)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

      const currentIdx = columnTasks.findIndex((t) => t.id === taskId);
      const newIdx = direction === "up" ? currentIdx - 1 : currentIdx + 1;
      if (newIdx < 0 || newIdx >= columnTasks.length) return;

      reorderInColumn(taskId, task.status as TaskStatus, newIdx);
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Multi-select mode toggle (Issue #1023) ─────────────────────────────

  function toggleMultiSelectMode() {
    if (multiSelectMode) {
      // Exiting multi-select: clear selection
      setSelectedIds(new Set());
    }
    setMultiSelectMode((prev) => !prev);
  }

  // ── Bulk selection helpers ────────────────────────────────────────────

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

  // Issue #1023: batch operations via Promise.allSettled with concurrency limit
  async function executeBulkAction(updates: Record<string, unknown>) {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    setBulkToast(null);
    try {
      const BATCH_SIZE = 5;
      const ids = [...selectedIds];
      const results: PromiseSettledResult<Response>[] = [];
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const chunk = ids.slice(i, i + BATCH_SIZE);
        const chunkResults = await Promise.allSettled(
          chunk.map((id) =>
            fetch(`/api/tasks/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updates),
            }).then((r) => {
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              return r;
            })
          )
        );
        results.push(...chunkResults);
      }
      const succeeded = results.filter(
        (r) => r.status === "fulfilled"
      ).length;
      const failed = results.length - succeeded;
      if (failed === 0) {
        setBulkToast({
          type: "success",
          message: `${succeeded} 項已更新`,
        });
        clearSelection();
      } else if (succeeded === 0) {
        setBulkToast({
          type: "error",
          message: `${failed} 項更新失敗`,
        });
      } else {
        setBulkToast({
          type: "partial",
          message: `${succeeded} 項已更新，${failed} 項失敗`,
        });
        // Keep only failed task IDs selected for retry
        const failedIds = ids.filter((_, idx) => results[idx].status === "rejected");
        setSelectedIds(new Set(failedIds));
      }
      await fetchTasks();
      setTimeout(() => setBulkToast(null), 3000);
    } finally {
      setBulkLoading(false);
    }
  }

  // ── Derived data ────────────────────────────────────────────────────────

  const tasksByStatus = (status: TaskStatus) =>
    tasks
      .filter((t) => t.status === status)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const hasSelection = selectedIds.size > 0;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
            看板
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            共 {tasks.length} 項任務
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Multi-select toggle (Issue #1023) */}
          <button
            onClick={toggleMultiSelectMode}
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-all",
              multiSelectMode
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
            data-testid="multi-select-toggle"
          >
            <MousePointerSquareDashed className="h-3.5 w-3.5" />
            多選
          </button>
          <button
            onClick={async () => {
              const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: "新任務",
                  status: "BACKLOG",
                  priority: "P2",
                  category: "PLANNED",
                }),
              });
              if (res.ok) {
                const created = await res.json();
                const newId = created.id ?? created.data?.id;
                await fetchTasks();
                if (newId) setSelectedTaskId(newId);
              } else {
                const errBody = await res.json().catch(() => ({}));
                toast.error(
                  errBody?.message ?? errBody?.error ?? "建立失敗"
                );
              }
            }}
            className="flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-primary text-primary-foreground rounded-lg shadow-sm transition-all hover:opacity-90 flex-1 sm:flex-none"
          >
            <Plus className="h-3.5 w-3.5" />
            新增任務
          </button>
        </div>
      </div>

      {/* Drag-and-drop onboarding hint (Issue #1068) */}
      {showDragHint && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg text-sm flex-shrink-0">
          <GripVertical className="h-4 w-4 text-primary shrink-0" />
          <span className="text-foreground/80">
            <strong>拖曳卡片</strong>到不同欄位即可變更任務狀態
          </span>
          <button
            onClick={() => {
              setShowDragHint(false);
              localStorage.setItem("titan-kanban-onboarded", "1");
            }}
            className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex-shrink-0 space-y-2">
        <TaskFilters
          filters={filters}
          onChange={setFilters}
          totalCount={allTasks.length}
          filteredCount={tasks.length}
          syncUrl
        />
        {/* Project filter — Issue #1176 */}
        {projectOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              aria-label="篩選項目"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-9 bg-card border border-border text-foreground text-sm rounded-lg px-3 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 cursor-pointer hover:border-muted-foreground/30 transition-all shadow-sm"
            >
              <option value="">所有項目</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} {p.name}
                </option>
              ))}
            </select>
            {projectFilter && (
              <button
                onClick={() => setProjectFilter("")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bulk action bar — visible when tasks are selected in multi-select mode */}
      {hasSelection && (
        <div className="flex-shrink-0 flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <CheckSquare className="h-4 w-4" />
            已選取 {selectedIds.size} 項
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Batch status change */}
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
            data-testid="bulk-status-select"
          >
            <option value="" disabled>
              批次移動狀態
            </option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
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
            <option value="" disabled>
              變更優先度
            </option>
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {/* Batch assignee change */}
          <select
            className="text-sm border border-border rounded-md px-2 py-1 bg-background"
            defaultValue=""
            disabled={bulkLoading}
            onChange={(e) => {
              if (e.target.value) {
                const val =
                  e.target.value === "__unassign__" ? null : e.target.value;
                executeBulkAction({ primaryAssigneeId: val });
                e.target.value = "";
              }
            }}
            data-testid="bulk-assignee-select"
          >
            <option value="" disabled>
              批次指派
            </option>
            <option value="__unassign__">取消指派</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          {/* Bulk deadline (Issue #1071) */}
          <input
            type="date"
            onChange={(e) => {
              if (e.target.value) {
                executeBulkAction({ dueDate: new Date(e.target.value).toISOString() });
                e.target.value = "";
              }
            }}
            className="h-7 px-2 text-xs border border-border rounded-md bg-background text-foreground cursor-pointer"
            title="批次設定截止日"
          />

          {bulkLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}

          <button
            onClick={() => {
              clearSelection();
              setMultiSelectMode(false);
            }}
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
      ) : tasks.length === 0 && !hasActiveFilters(filters) ? (
        <div className="flex-1">
          <PageEmpty
            icon={<Kanban className="h-10 w-10" />}
            title="尚無任務"
            description="目前沒有任何任務，請點擊「新增任務」開始"
          />
        </div>
      ) : (
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
                selectedIds={selectedIds}
                hasSelection={multiSelectMode || hasSelection}
                customName={columnNames[status]}
                onColumnNameChange={handleColumnNameChange}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onTaskClick={setSelectedTaskId}
                onToggleSelect={toggleSelect}
                onKeyboardMove={handleKeyboardMove}
                onKeyboardReorder={handleKeyboardReorder}
              />
            </div>
          ))}
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

      {/* Bulk operation toast (Issue #1023) */}
      {bulkToast && (
        <div
          className={cn(
            "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium",
            "animate-in fade-in slide-in-from-bottom-2 duration-200",
            bulkToast.type === "success" &&
              "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30",
            bulkToast.type === "error" &&
              "bg-red-500/10 text-red-400 border border-red-500/30",
            bulkToast.type === "partial" &&
              "bg-amber-500/10 text-amber-500 border border-amber-500/30"
          )}
          role="status"
          data-testid="bulk-toast"
        >
          {bulkToast.type === "success" ? (
            <Check className="h-4 w-4" />
          ) : bulkToast.type === "error" ? (
            <X className="h-4 w-4" />
          ) : (
            <CheckSquare className="h-4 w-4" />
          )}
          {bulkToast.message}
        </div>
      )}
    </div>
  );
}
