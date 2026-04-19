"use client";

/**
 * Kanban Page — Issue #803 (K-1)
 *
 * Orchestrator: holds all state + business logic; delegates rendering to
 *   - KanbanFilters  (filter bar)
 *   - KanbanBoard    (5-column board)
 *   - BulkActionBar / BulkOperationToast / TemplateImportDialog (task-quick-edit)
 *   - TaskDetailModal
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Loader2,
  MousePointerSquareDashed,
  GripVertical,
  X,
  FileInput,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { extractItems } from "@/lib/api-client";
import { type TaskCardData } from "@/app/components/task-card";
import {
  type TaskFilters as FiltersType,
  parseFiltersFromUrl,
} from "@/app/components/task-filters";
import { TaskDetailModal } from "@/app/components/task-detail-modal";
import { calculatePosition } from "@/lib/utils/optimistic-update";
import { KanbanFilters } from "@/app/components/kanban/kanban-filters";
import { KanbanBoard, type TaskStatus, COLUMN_ORDER } from "@/app/components/kanban/kanban-board";
import {
  BulkActionBar,
  BulkOperationToast,
  TemplateImportDialog,
  type BulkToast,
} from "@/app/components/kanban/task-quick-edit";

// ─── Local helpers ────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KanbanPage() {
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<(TaskCardData & { position?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [allTasks, setAllTasks] = useState<(TaskCardData & { position?: number })[]>([]);
  const [filters, setFilters] = useState<FiltersType>(() =>
    parseFiltersFromUrl(new URLSearchParams(searchParams.toString()))
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showDragHint, setShowDragHint] = useState(false);

  // Issue #1231: auto-open task detail modal from URL ?task= parameter
  useEffect(() => {
    const taskParam = searchParams.get("task");
    if (taskParam) setSelectedTaskId(taskParam);
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
  const [bulkToast, setBulkToast] = useState<BulkToast | null>(null);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  // Project filter state (Issue #1176)
  const [projectFilter, setProjectFilter] = useState("");
  const [projectOptions, setProjectOptions] = useState<{ id: string; code: string; name: string }[]>([]);

  // Template import dialog state (Issue #1266)
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Ref to always access latest tasks (avoids stale closures in keyboard handlers)
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  // Ref to always access latest moveTask without stale closures
  const moveTaskRef = useRef<(taskId: string, newStatus: TaskStatus, targetIndex?: number) => Promise<void>>(async () => {});

  // Snapshot for rollback
  const tasksSnapshot = useRef<(TaskCardData & { position?: number })[]>([]);

  // Load custom column names from localStorage
  useEffect(() => { setColumnNames(loadColumnNames()); }, []);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      if (filters.assignee) params.set("assignee", filters.assignee);
      if (filters.priority) params.set("priority", filters.priority);
      if (filters.category) params.set("category", filters.category);
      if (projectFilter) params.set("projectId", projectFilter);
      if (filters.sortBy) params.set("sortBy", filters.sortBy);
      if (filters.sortOrder) params.set("order", filters.sortOrder);
      const res = await fetch(`/api/tasks?${params}`);
      if (!res.ok) throw new Error("任務載入失敗");
      const body = await res.json();
      const fetched = extractItems<TaskCardData & { position?: number; tags?: string[]; dueDate?: string | null }>(body);
      setAllTasks(fetched);

      let filtered = fetched;
      if (filters.tags.length > 0) {
        filtered = filtered.filter((t) =>
          filters.tags.every((tag) => (t as unknown as { tags?: string[] }).tags?.includes(tag))
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

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Fetch users + projects for filters
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((body) => {
        const list = extractItems<{ id: string; name: string }>(body);
        setUsers(list.map((u) => ({ id: u.id, name: u.name })));
      })
      .catch(() => { toast.error("使用者清單載入失敗"); });
    fetch("/api/projects?limit=100")
      .then((r) => r.json())
      .then((body) => {
        const data = body?.data ?? body;
        const items = data?.items ?? [];
        setProjectOptions(items.map((p: { id: string; code: string; name: string }) => ({ id: p.id, code: p.code, name: p.name })));
      })
      .catch(() => { toast.error("專案清單載入失敗"); });
  }, []);

  // ── Column name management ────────────────────────────────────────────────

  const handleColumnNameChange = useCallback((status: TaskStatus, name: string) => {
    setColumnNames((prev) => {
      const next = { ...prev, [status]: name };
      saveColumnNames(next);
      return next;
    });
  }, []);

  // ── Move task between columns (optimistic) ────────────────────────────────

  async function moveTask(taskId: string, newStatus: TaskStatus, targetIndex?: number) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) {
      if (task && targetIndex !== undefined) {
        await reorderInColumn(taskId, task.status as TaskStatus, targetIndex);
      }
      return;
    }

    tasksSnapshot.current = [...tasks];

    const columnTasks = tasks
      .filter((t) => t.status === newStatus && t.id !== taskId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const insertIdx = targetIndex ?? columnTasks.length;
    const prevPos = insertIdx > 0 ? (columnTasks[insertIdx - 1]?.position ?? 0) : null;
    const nextPos = insertIdx < columnTasks.length ? (columnTasks[insertIdx]?.position ?? 0) : null;
    const newPosition = calculatePosition(prevPos, nextPos);

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: newStatus as TaskCardData["status"], position: newPosition } : t
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
        setTasks(tasksSnapshot.current);
        toast.error("任務更新失敗");
      } else {
        const reorderRes = await fetch("/api/tasks/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: [{ id: taskId, position: newPosition, status: newStatus }] }),
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

  moveTaskRef.current = moveTask;

  // ── Reorder within same column ────────────────────────────────────────────

  async function reorderInColumn(taskId: string, status: TaskStatus, targetIndex: number) {
    const columnTasks = tasks
      .filter((t) => t.status === status)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const currentIndex = columnTasks.findIndex((t) => t.id === taskId);
    if (currentIndex === targetIndex || currentIndex === -1) return;

    const filtered = columnTasks.filter((t) => t.id !== taskId);
    const prevPos = targetIndex > 0 ? (filtered[targetIndex - 1]?.position ?? 0) : null;
    const nextPos = targetIndex < filtered.length ? (filtered[targetIndex]?.position ?? 0) : null;
    const newPosition = calculatePosition(prevPos, nextPos);

    tasksSnapshot.current = [...tasks];
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, position: newPosition } : t)));

    try {
      await fetch("/api/tasks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ id: taskId, position: newPosition }] }),
      });
    } catch {
      setTasks(tasksSnapshot.current);
    }
  }

  // ── Drag & drop handlers ──────────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(taskId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOver(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(status);
  }, []);

  const handleDragLeave = useCallback(() => { setDragOver(null); }, []);

  const handleDrop = useCallback((e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId) {
      const container = e.currentTarget as HTMLElement;
      const cards = container.querySelectorAll("[data-task-id]");
      let targetIdx = tasksRef.current.filter((t) => t.status === status).length;
      for (let i = 0; i < cards.length; i++) {
        const rect = cards[i].getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) { targetIdx = i; break; }
      }
      moveTaskRef.current(taskId, status, targetIdx);
    }
    setDragOver(null);
    setDraggingId(null);
  }, []);

  // ── Keyboard navigation ───────────────────────────────────────────────────

  const handleKeyboardMove = useCallback((taskId: string, direction: "left" | "right") => {
    const task = tasksRef.current.find((t) => t.id === taskId);
    if (!task) return;
    const currentIdx = COLUMN_ORDER.indexOf(task.status as TaskStatus);
    const newIdx = direction === "left" ? currentIdx - 1 : currentIdx + 1;
    if (newIdx < 0 || newIdx >= COLUMN_ORDER.length) return;
    moveTask(taskId, COLUMN_ORDER[newIdx]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyboardReorder = useCallback((taskId: string, direction: "up" | "down") => {
    const task = tasksRef.current.find((t) => t.id === taskId);
    if (!task) return;
    const columnTasks = tasksRef.current
      .filter((t) => t.status === task.status)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const currentIdx = columnTasks.findIndex((t) => t.id === taskId);
    const newIdx = direction === "up" ? currentIdx - 1 : currentIdx + 1;
    if (newIdx < 0 || newIdx >= columnTasks.length) return;
    reorderInColumn(taskId, task.status as TaskStatus, newIdx);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Create task ───────────────────────────────────────────────────────────

  async function handleCreateTask() {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "新任務", status: "BACKLOG", priority: "P2", category: "PLANNED" }),
    });
    if (res.ok) {
      const created = await res.json();
      const newId = created.id ?? created.data?.id;
      await fetchTasks();
      if (newId) setSelectedTaskId(newId);
    } else {
      const errBody = await res.json().catch(() => ({}));
      toast.error(errBody?.message ?? errBody?.error ?? "建立失敗");
    }
  }

  // ── Multi-select (Issue #1023) ────────────────────────────────────────────

  function toggleMultiSelectMode() {
    if (multiSelectMode) setSelectedIds(new Set());
    setMultiSelectMode((prev) => !prev);
  }

  const toggleSelect = useCallback((taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) { next.delete(taskId); } else { next.add(taskId); }
      return next;
    });
  }, []);

  function clearSelection() { setSelectedIds(new Set()); }

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
            }).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r; })
          )
        );
        results.push(...chunkResults);
      }
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;
      if (failed === 0) {
        setBulkToast({ type: "success", message: `${succeeded} 項已更新` });
        clearSelection();
      } else if (succeeded === 0) {
        setBulkToast({ type: "error", message: `${failed} 項更新失敗` });
      } else {
        setBulkToast({ type: "partial", message: `${succeeded} 項已更新，${failed} 項失敗` });
        const failedIds = ids.filter((_, idx) => results[idx].status === "rejected");
        setSelectedIds(new Set(failedIds));
      }
      await fetchTasks();
      setTimeout(() => setBulkToast(null), 3000);
    } finally {
      setBulkLoading(false);
    }
  }

  // ── Template import (Issue #1266) ─────────────────────────────────────────

  async function handleImportTemplate() {
    setImportError(null);
    let parsed: unknown;
    try { parsed = JSON.parse(importJson); } catch { setImportError("JSON 格式錯誤，請確認格式正確"); return; }

    const taskList = Array.isArray(parsed) ? parsed : (parsed as { tasks?: unknown[] }).tasks;
    if (!Array.isArray(taskList) || taskList.length === 0) {
      setImportError("請提供至少一筆任務（tasks 陣列）");
      return;
    }

    setImportLoading(true);
    try {
      const res = await fetch("/api/tasks/import-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: taskList }),
      });
      const body = await res.json();
      if (!res.ok) { setImportError(body?.message ?? body?.error ?? "匯入失敗"); return; }
      const created = body?.data?.created ?? body?.created ?? 0;
      const failed = body?.data?.failed ?? body?.failed ?? 0;
      setImportDialogOpen(false);
      setImportJson("");
      await fetchTasks();
      if (failed === 0) { toast.success(`已匯入 ${created} 筆任務`); }
      else { toast.warning(`匯入完成：${created} 筆成功，${failed} 筆失敗`); }
    } catch {
      setImportError("網路錯誤，請稍後再試");
    } finally {
      setImportLoading(false);
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const tasksByStatusMap = useMemo(() => {
    const map = new Map<TaskStatus, (TaskCardData & { position?: number })[]>();
    for (const task of tasks) {
      const status = task.status as TaskStatus;
      const list = map.get(status) ?? [];
      list.push(task);
      map.set(status, list);
    }
    for (const [status, list] of map) {
      map.set(status, [...list].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)));
    }
    return map;
  }, [tasks]);

  const hasSelection = selectedIds.size > 0;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">看板</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">共 {tasks.length} 項任務</p>
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
          {/* Import template button (Issue #1266) */}
          <button
            onClick={() => { setImportDialogOpen(true); setImportError(null); setImportJson(""); }}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-background border border-border text-muted-foreground rounded-lg shadow-sm transition-all hover:text-foreground hover:bg-accent/50"
            title="從範本匯入"
          >
            <FileInput className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">從範本匯入</span>
          </button>
          <button
            onClick={handleCreateTask}
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
            onClick={() => { setShowDragHint(false); localStorage.setItem("titan-kanban-onboarded", "1"); }}
            className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
            aria-label="關閉提示"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Filters */}
      <KanbanFilters
        filters={filters}
        allTaskCount={allTasks.length}
        filteredTaskCount={tasks.length}
        projectFilter={projectFilter}
        projectOptions={projectOptions}
        onFiltersChange={setFilters}
        onProjectFilterChange={setProjectFilter}
      />

      {/* Bulk action bar */}
      {hasSelection && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          bulkLoading={bulkLoading}
          users={users}
          onBulkAction={executeBulkAction}
          onClearSelection={() => { clearSelection(); setMultiSelectMode(false); }}
        />
      )}

      {/* Board */}
      <KanbanBoard
        tasks={tasks}
        loading={loading}
        fetchError={fetchError}
        filters={filters}
        draggingId={draggingId}
        dragOver={dragOver}
        movingTask={movingTask}
        selectedIds={selectedIds}
        multiSelectMode={multiSelectMode}
        columnNames={columnNames}
        tasksByStatusMap={tasksByStatusMap}
        onCreateTask={handleCreateTask}
        onRetry={fetchTasks}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onTaskClick={setSelectedTaskId}
        onToggleSelect={toggleSelect}
        onKeyboardMove={handleKeyboardMove}
        onKeyboardReorder={handleKeyboardReorder}
        onColumnNameChange={handleColumnNameChange}
      />

      {/* Task detail modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdated={() => { setSelectedTaskId(null); fetchTasks(); }}
        />
      )}

      {/* Template import dialog (Issue #1266) */}
      {importDialogOpen && (
        <TemplateImportDialog
          importJson={importJson}
          importLoading={importLoading}
          importError={importError}
          onJsonChange={(v) => { setImportJson(v); setImportError(null); }}
          onImport={handleImportTemplate}
          onClose={() => setImportDialogOpen(false)}
        />
      )}

      {/* Bulk operation toast (Issue #1023) */}
      {bulkToast && <BulkOperationToast toast={bulkToast} />}
    </div>
  );
}
