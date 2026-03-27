"use client";

/**
 * TaskSidebarDrag — Left sidebar task list with HTML5 drag-and-drop (Issue #1003)
 *
 * Renders a draggable task list on the left side of CalendarDayView.
 * User can drag a task item onto a time slot to create a time entry.
 */

import { useState, useCallback, type DragEvent } from "react";
import { cn } from "@/lib/utils";
import { GripVertical, Search } from "lucide-react";
import { type TaskOption } from "./use-timesheet";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskDragData {
  taskId: string;
  taskTitle: string;
  category: string;
  estimatedHours: number | null;
}

interface TaskSidebarDragProps {
  tasks: TaskOption[];
  onDropOnTimeSlot: (data: TaskDragData, hour: number) => void;
}

// ─── Draggable Task Item ──────────────────────────────────────────────────────

function DraggableTaskItem({ task }: { task: TaskOption }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      const dragData: TaskDragData = {
        taskId: task.id,
        taskTitle: task.title,
        category: "PLANNED_TASK",
        estimatedHours: null,
      };
      e.dataTransfer.setData("application/json", JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = "copy";
      setIsDragging(true);
    },
    [task]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        "flex items-center gap-2 px-2 py-2 rounded-md border border-border/50 cursor-grab active:cursor-grabbing transition-all text-xs group",
        isDragging
          ? "opacity-50 border-primary/50 bg-primary/5"
          : "hover:bg-accent/50 hover:border-border"
      )}
      data-testid={`draggable-task-${task.id}`}
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0 group-hover:text-muted-foreground transition-colors" />
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate text-foreground">{task.title}</div>
      </div>
    </div>
  );
}

// ─── Main Sidebar Component ──────────────────────────────────────────────────

export function TaskSidebarDrag({ tasks, onDropOnTimeSlot }: TaskSidebarDragProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTasks = tasks.filter((task) => {
    if (!searchTerm) return true;
    const lower = searchTerm.toLowerCase();
    return task.title.toLowerCase().includes(lower);
  });

  // Expose the onDropOnTimeSlot handler via a global function for CalendarDayView integration
  // This is used when the user drops a task on the time grid
  if (typeof window !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__taskSidebarDropHandler = onDropOnTimeSlot;
  }

  return (
    <div
      className="w-48 flex-shrink-0 border-r border-border pr-3 flex flex-col gap-2 h-full"
      data-testid="task-sidebar-drag"
    >
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
        任務清單
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <input
          type="text"
          placeholder="搜尋任務..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-7 pr-2 py-1.5 text-xs bg-background border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
          data-testid="task-sidebar-search"
        />
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0" data-testid="task-sidebar-list">
        {filteredTasks.length === 0 ? (
          <p className="text-[10px] text-muted-foreground text-center py-4">
            {searchTerm ? "無符合的任務" : "尚無任務"}
          </p>
        ) : (
          filteredTasks.map((task) => (
            <DraggableTaskItem key={task.id} task={task} />
          ))
        )}
      </div>

      <div className="text-[10px] text-muted-foreground text-center py-1 border-t border-border/30">
        拖曳任務至時間表建立工時
      </div>
    </div>
  );
}

// ─── Drop Zone Helpers (for CalendarDayView integration) ─────────────────────

export function handleTaskDragOver(e: DragEvent<HTMLDivElement>) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
}

export function handleTaskDrop(
  e: DragEvent<HTMLDivElement>,
  minHour: number,
  hourHeight: number,
  gridRef: React.RefObject<HTMLDivElement | null>,
  onDrop: (data: TaskDragData, hour: number) => void
) {
  e.preventDefault();
  try {
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    const data: TaskDragData = JSON.parse(raw);

    // Calculate which hour the drop occurred at
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hour = minHour + y / hourHeight;
    const snappedHour = Math.round(hour * 4) / 4; // snap to 15 min

    onDrop(data, snappedHour);
  } catch {
    // Invalid drag data
  }
}
