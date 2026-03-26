"use client";

import { cn } from "@/lib/utils";
import { safeNum } from "@/lib/safe-number";
import { type TimeEntry } from "../use-timesheet";
import {
  HOUR_HEIGHT,
  MIN_HOUR,
  TOTAL_HOURS,
  hoursToTime,
  formatDuration,
  getBlockStyle,
  getCatColor,
  getCatBg,
} from "../calendar-utils";

type DragCreateState = {
  dayIndex: number;
  startHour: number;
  endHour: number;
  active: boolean;
};

type DayColumnProps = {
  dayIndex: number;
  dateStr: string;
  entries: TimeEntry[];
  isWeekend: boolean;
  isDragTarget: boolean;
  dragCreate: DragCreateState | null;
  editingEntryId: string | null;
  columnRef: (el: HTMLDivElement | null) => void;
  onMouseDown: (dayIndex: number, e: React.MouseEvent) => void;
  onMouseMove: (dayIndex: number, e: React.MouseEvent) => void;
  onMouseUp: (dayIndex: number) => void;
  onDragOver: (dayIndex: number, e: React.DragEvent) => void;
  onDrop: (dayIndex: number, e: React.DragEvent) => void;
  onBlockClick: (entry: TimeEntry, e: React.MouseEvent) => void;
  onBlockDragStart: (entryId: string, dayIndex: number, e: React.DragEvent) => void;
};

export type { DragCreateState };

export function DayColumn({
  dayIndex,
  dateStr,
  entries,
  isWeekend,
  isDragTarget,
  dragCreate,
  editingEntryId,
  columnRef,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onDragOver,
  onDrop,
  onBlockClick,
  onBlockDragStart,
}: DayColumnProps) {
  const dayEntries = entries.filter((e) => e.startTime && e.endTime);

  return (
    <div
      key={dateStr}
      ref={columnRef}
      className={cn(
        "relative border-r border-border last:border-r-0 select-none",
        isWeekend && "bg-muted/15",
        isDragTarget && "bg-accent/10"
      )}
      style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
      data-testid={`day-column-${dayIndex}`}
      onMouseDown={(e) => onMouseDown(dayIndex, e)}
      onMouseMove={(e) => onMouseMove(dayIndex, e)}
      onMouseUp={() => onMouseUp(dayIndex)}
      onMouseLeave={() => {
        if (dragCreate?.active && dragCreate.dayIndex === dayIndex) {
          onMouseUp(dayIndex);
        }
      }}
      onDragOver={(e) => onDragOver(dayIndex, e)}
      onDrop={(e) => onDrop(dayIndex, e)}
    >
      {/* Hour grid lines */}
      {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t border-border/30"
          style={{ top: i * HOUR_HEIGHT }}
        />
      ))}

      {/* Time blocks */}
      {dayEntries.map((entry) => {
        const style = getBlockStyle(entry.startTime!, entry.endTime!, HOUR_HEIGHT);
        const height = safeNum(style.height, 24);
        const isEditing = editingEntryId === entry.id;

        return (
          <div
            key={entry.id}
            data-time-block
            data-testid="week-time-block"
            draggable
            onDragStart={(e) => onBlockDragStart(entry.id, dayIndex, e)}
            className={cn(
              "absolute left-0.5 right-0.5 rounded-sm border px-1 py-0.5 cursor-pointer transition-all overflow-hidden text-[10px]",
              getCatBg(entry.category),
              isEditing && "ring-2 ring-ring z-20"
            )}
            style={style}
            onClick={(e) => onBlockClick(entry, e)}
          >
            <div className="font-medium truncate leading-tight">
              {entry.task?.title ?? "自由工時"}
            </div>
            {height >= 36 && (
              <div className="text-muted-foreground tabular-nums leading-tight">
                {entry.startTime}–{entry.endTime}
              </div>
            )}
            {height >= 48 && (
              <div className="flex items-center gap-0.5 mt-px">
                <span className={cn("w-1 h-1 rounded-full", getCatColor(entry.category))} />
                <span className="text-muted-foreground truncate">
                  {formatDuration(entry.hours)}
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Drag-to-create preview */}
      {dragCreate?.active && dragCreate.dayIndex === dayIndex && (
        <div
          className="absolute left-0.5 right-0.5 bg-blue-500/20 border border-blue-500/40 rounded-sm pointer-events-none z-10"
          style={{
            top: (Math.min(dragCreate.startHour, dragCreate.endHour) - MIN_HOUR) * HOUR_HEIGHT,
            height: Math.abs(dragCreate.endHour - dragCreate.startHour) * HOUR_HEIGHT || HOUR_HEIGHT * 0.25,
          }}
          data-testid="week-drag-preview"
        >
          <div className="px-1 py-0.5 text-[10px] text-blue-400 tabular-nums">
            {hoursToTime(Math.min(dragCreate.startHour, dragCreate.endHour))} —{" "}
            {hoursToTime(Math.max(dragCreate.startHour, dragCreate.endHour))}
          </div>
        </div>
      )}
    </div>
  );
}
