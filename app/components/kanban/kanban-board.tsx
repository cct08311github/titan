"use client";

/**
 * KanbanBoard — renders the 5-column board area extracted from kanban/page.tsx.
 * Pure presentational: receives all state and handlers as props.
 */

import { Plus, Kanban } from "lucide-react";
import { type TaskCardData } from "@/app/components/task-card";
import { type TaskFilters as FiltersType, hasActiveFilters } from "@/app/components/task-filters";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";
import { KanbanColumn } from "@/app/components/kanban-column";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

export const COLUMN_ORDER: TaskStatus[] = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
];

export const DEFAULT_COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: "BACKLOG", label: "待辦清單", color: "text-muted-foreground" },
  { status: "TODO", label: "待處理", color: "text-blue-400" },
  { status: "IN_PROGRESS", label: "進行中", color: "text-yellow-400" },
  { status: "REVIEW", label: "審核中", color: "text-purple-400" },
  { status: "DONE", label: "已完成", color: "text-emerald-400" },
];

export const columnBorder: Record<TaskStatus, string> = {
  BACKLOG: "border-border",
  TODO: "border-blue-500/20",
  IN_PROGRESS: "border-yellow-500/20",
  REVIEW: "border-purple-500/20",
  DONE: "border-emerald-500/20",
};

export const columnHeaderBg: Record<TaskStatus, string> = {
  BACKLOG: "bg-muted/60",
  TODO: "bg-blue-500/10",
  IN_PROGRESS: "bg-yellow-500/10",
  REVIEW: "bg-purple-500/10",
  DONE: "bg-emerald-500/10",
};

const EMPTY_TASK_ARRAY: (TaskCardData & { position?: number })[] = [];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface KanbanBoardProps {
  tasks: (TaskCardData & { position?: number })[];
  loading: boolean;
  fetchError: string | null;
  filters: FiltersType;
  draggingId: string | null;
  dragOver: TaskStatus | null;
  movingTask: string | null;
  selectedIds: Set<string>;
  multiSelectMode: boolean;
  columnNames: Record<string, string>;
  tasksByStatusMap: Map<TaskStatus, (TaskCardData & { position?: number })[]>;
  onCreateTask: () => void;
  onRetry: () => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, status: TaskStatus) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, status: TaskStatus) => void;
  onTaskClick: (taskId: string) => void;
  onToggleSelect: (taskId: string) => void;
  onKeyboardMove: (taskId: string, direction: "left" | "right") => void;
  onKeyboardReorder: (taskId: string, direction: "up" | "down") => void;
  onColumnNameChange: (status: TaskStatus, name: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function KanbanBoard({
  tasks,
  loading,
  fetchError,
  filters,
  draggingId,
  dragOver,
  movingTask,
  selectedIds,
  multiSelectMode,
  columnNames,
  tasksByStatusMap,
  onCreateTask,
  onRetry,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onTaskClick,
  onToggleSelect,
  onKeyboardMove,
  onKeyboardReorder,
  onColumnNameChange,
}: KanbanBoardProps) {
  const hasSelection = selectedIds.size > 0;

  if (loading) {
    return (
      <div className="flex-1">
        <PageLoading message="載入看板..." />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex-1">
        <PageError message={fetchError} onRetry={onRetry} />
      </div>
    );
  }

  if (tasks.length === 0 && !hasActiveFilters(filters)) {
    return (
      <div className="flex-1">
        <PageEmpty
          icon={<Kanban className="h-10 w-10" />}
          title="建立第一個任務開始工作"
          description="把待辦事項加入看板，拖曳卡片即可更新進度"
          action={
            <button
              onClick={onCreateTask}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              建立任務
            </button>
          }
        />
      </div>
    );
  }

  return (
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
            tasks={tasksByStatusMap.get(status) ?? EMPTY_TASK_ARRAY}
            draggingId={draggingId}
            isDragOver={dragOver === status}
            movingTaskId={movingTask}
            selectedIds={selectedIds}
            hasSelection={multiSelectMode || hasSelection}
            customName={columnNames[status]}
            onColumnNameChange={onColumnNameChange}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onTaskClick={onTaskClick}
            onToggleSelect={onToggleSelect}
            onKeyboardMove={onKeyboardMove}
            onKeyboardReorder={onKeyboardReorder}
          />
        </div>
      ))}
    </div>
  );
}
