"use client";

/**
 * KanbanColumn — Issue #803 (K-1)
 *
 * Reusable kanban column component with:
 * - Drag & drop zone
 * - Custom column name editing
 * - Visual feedback during drag
 * - Keyboard accessibility (Tab, Enter, Arrow keys)
 */

import { useState, useRef, useCallback, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Loader2, GripVertical, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskCard, type TaskCardData } from "./task-card";

type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

export interface KanbanColumnProps {
  status: TaskStatus;
  label: string;
  color: string;
  borderClass: string;
  headerBgClass: string;
  tasks: TaskCardData[];
  /** Currently dragging task ID */
  draggingId: string | null;
  /** Is this column the current drag-over target? */
  isDragOver: boolean;
  /** Task ID currently being moved (API in progress) */
  movingTaskId: string | null;
  /** Selected task IDs for bulk operations */
  selectedIds: Set<string>;
  /** Whether any tasks are selected (show checkboxes) */
  hasSelection: boolean;
  /** Custom column name (user override) */
  customName?: string;
  /** Callback when column name is edited */
  onColumnNameChange?: (status: TaskStatus, name: string) => void;
  /** Drag event handlers */
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, status: TaskStatus) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, status: TaskStatus) => void;
  /** Card click */
  onTaskClick: (taskId: string) => void;
  /** Bulk selection toggle */
  onToggleSelect: (taskId: string) => void;
  /** Keyboard move: move task to adjacent column */
  onKeyboardMove?: (taskId: string, direction: "left" | "right") => void;
  /** Keyboard reorder: move task up/down within column */
  onKeyboardReorder?: (taskId: string, direction: "up" | "down") => void;
}

export function KanbanColumn({
  status,
  label,
  color,
  borderClass,
  headerBgClass,
  tasks,
  draggingId,
  isDragOver,
  movingTaskId,
  selectedIds,
  hasSelection,
  customName,
  onColumnNameChange,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onTaskClick,
  onToggleSelect,
  onKeyboardMove,
  onKeyboardReorder,
}: KanbanColumnProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(customName ?? label);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const displayName = customName ?? label;

  const startEditing = useCallback(() => {
    setEditName(displayName);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [displayName]);

  const saveName = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== label) {
      onColumnNameChange?.(status, trimmed);
    } else if (!trimmed) {
      // Reset to default
      onColumnNameChange?.(status, label);
    }
    setIsEditing(false);
  }, [editName, label, status, onColumnNameChange]);

  const cancelEdit = useCallback(() => {
    setEditName(displayName);
    setIsEditing(false);
  }, [displayName]);

  const handleEditKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      saveName();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  /** Handle keyboard navigation on task cards */
  const handleCardKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>, taskId: string) => {
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        onKeyboardMove?.(taskId, "left");
        break;
      case "ArrowRight":
        e.preventDefault();
        onKeyboardMove?.(taskId, "right");
        break;
      case "ArrowUp":
        e.preventDefault();
        onKeyboardReorder?.(taskId, "up");
        break;
      case "ArrowDown":
        e.preventDefault();
        onKeyboardReorder?.(taskId, "down");
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        onTaskClick(taskId);
        break;
    }
  };

  const handleColumnDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    onDragOver(e, status);

    // Calculate drop position for visual indicator
    const container = e.currentTarget as HTMLElement;
    const cards = container.querySelectorAll("[data-task-id]");
    let targetIdx = tasks.length;
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        targetIdx = i;
        break;
      }
    }
    setDropTargetIndex(targetIdx);
  };

  const handleColumnDragLeave = () => {
    onDragLeave();
    setDropTargetIndex(null);
  };

  const handleColumnDrop = (e: React.DragEvent) => {
    onDrop(e, status);
    setDropTargetIndex(null);
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border transition-colors",
        "w-full md:w-72 md:flex-shrink-0",
        borderClass,
        isDragOver && "ring-2 ring-primary/30 bg-accent/5"
      )}
      role="region"
      aria-label={`${displayName} 欄位，${tasks.length} 項任務`}
    >
      {/* Column header */}
      <div className={cn("flex items-center justify-between px-3 py-2.5 rounded-t-xl", headerBgClass)}>
        <div className="flex items-center gap-2 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleEditKeyDown}
                onBlur={saveName}
                maxLength={20}
                className="text-xs font-semibold uppercase tracking-wider bg-background border border-border rounded px-1.5 py-0.5 w-24 focus:outline-none focus:border-primary"
                aria-label="編輯欄位名稱"
              />
              <button
                onClick={saveName}
                className="p-0.5 rounded hover:bg-accent text-emerald-500"
                aria-label="儲存欄位名稱"
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                onClick={cancelEdit}
                className="p-0.5 rounded hover:bg-accent text-muted-foreground"
                aria-label="取消編輯"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <>
              <span className={cn("text-xs font-semibold uppercase tracking-wider", color)}>
                {displayName}
              </span>
              <button
                onClick={startEditing}
                className="p-0.5 rounded opacity-0 group-hover/col:opacity-100 hover:bg-accent text-muted-foreground transition-opacity"
                aria-label={`編輯「${displayName}」欄位名稱`}
                title="編輯欄位名稱"
              >
                <Pencil className="h-2.5 w-2.5" />
              </button>
            </>
          )}
          <span className="text-xs text-muted-foreground tabular-nums bg-muted/60 px-1.5 py-0.5 rounded">
            {tasks.length}
          </span>
        </div>
        <span className="md:hidden text-[10px] text-muted-foreground">{tasks.length} 項</span>
      </div>

      {/* Cards */}
      <div
        className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px] max-h-[50vh] md:max-h-none md:min-h-[120px]"
        onDragOver={handleColumnDragOver}
        onDragLeave={handleColumnDragLeave}
        onDrop={handleColumnDrop}
      >
        {tasks.map((task, index) => (
          <div key={task.id}>
            {/* Drop indicator line */}
            {isDragOver && dropTargetIndex === index && (
              <div className="h-0.5 bg-primary rounded-full mx-1 mb-1 animate-pulse" />
            )}
            <div
              data-task-id={task.id}
              draggable
              onDragStart={(e) => onDragStart(e, task.id)}
              onDragEnd={onDragEnd}
              onKeyDown={(e) => handleCardKeyDown(e, task.id)}
              tabIndex={0}
              role="button"
              aria-label={`任務：${task.title}。使用方向鍵移動，Enter 開啟詳情`}
              aria-roledescription="可拖曳任務卡片"
              className={cn(
                "transition-all relative group/card outline-none",
                "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:rounded-xl",
                draggingId === task.id && "opacity-40 scale-95"
              )}
            >
              {/* Drag handle + Checkbox */}
              <div
                className={cn(
                  "absolute top-2 left-2 z-10 flex items-center gap-1",
                  hasSelection ? "opacity-100" : "opacity-0 group-hover/card:opacity-100",
                  "transition-opacity"
                )}
              >
                <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
                <input
                  type="checkbox"
                  checked={selectedIds.has(task.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleSelect(task.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 rounded border-border text-primary cursor-pointer"
                  aria-label={`選取 ${task.title}`}
                  tabIndex={-1}
                />
              </div>
              <div className={cn(selectedIds.has(task.id) && "ring-2 ring-primary/40 rounded-xl")}>
                <TaskCard
                  task={task}
                  onClick={() => onTaskClick(task.id)}
                  isDragging={draggingId === task.id}
                />
              </div>
              {movingTaskId === task.id && (
                <div className="flex justify-center py-1">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Drop indicator at end */}
        {isDragOver && dropTargetIndex === tasks.length && tasks.length > 0 && (
          <div className="h-0.5 bg-primary rounded-full mx-1 animate-pulse" />
        )}

        {tasks.length === 0 && (
          <div
            className={cn(
              "flex items-center justify-center h-16 md:h-20 rounded-lg border border-dashed text-xs text-muted-foreground transition-colors",
              isDragOver ? "border-primary bg-primary/5 text-foreground" : "border-border"
            )}
          >
            {isDragOver ? "放置到此欄" : "尚無任務"}
          </div>
        )}
      </div>
    </div>
  );
}
