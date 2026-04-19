"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { safeFixed } from "@/lib/safe-number";
import { type TimeEntry, type OvertimeType, type TaskOption } from "./use-timesheet";
import { CATEGORIES } from "./timesheet-cell";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { formatLocalDate } from "@/lib/utils/date";

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 60; // px per hour
const MIN_HOUR = 8;
const MAX_HOUR = 22;
const TOTAL_HOURS = MAX_HOUR - MIN_HOUR;
const SNAP_MINUTES = 15;

function getCatColor(cat: string): string {
  return CATEGORIES.find((c) => c.value === cat)?.dot ?? "bg-slate-400";
}

function getCatBg(cat: string): string {
  const map: Record<string, string> = {
    PLANNED_TASK: "bg-blue-500/15 border-blue-500/30 hover:bg-blue-500/25",
    ADDED_TASK: "bg-purple-500/15 border-purple-500/30 hover:bg-purple-500/25",
    INCIDENT: "bg-red-500/15 border-red-500/30 hover:bg-red-500/25",
    SUPPORT: "bg-orange-500/15 border-orange-500/30 hover:bg-orange-500/25",
    ADMIN: "bg-slate-400/15 border-slate-400/30 hover:bg-slate-400/25",
    LEARNING: "bg-emerald-500/15 border-emerald-500/30 hover:bg-emerald-500/25",
  };
  return map[cat] ?? "bg-slate-400/15 border-slate-400/30 hover:bg-slate-400/25";
}

function timeToHours(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h + (m || 0) / 60;
}

function hoursToTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function snapToGrid(hours: number): number {
  const mins = hours * 60;
  const snapped = Math.round(mins / SNAP_MINUTES) * SNAP_MINUTES;
  return snapped / 60;
}

function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  return `${safeFixed(hours, 1)}h`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CalendarDayViewProps = {
  selectedDate: Date;
  entries: TimeEntry[];
  tasks: TaskOption[];
  onDateChange: (date: Date) => void;
  onSaveEntry: (
    taskId: string | null,
    date: string,
    hours: number,
    category: string,
    description: string,
    overtimeType: OvertimeType,
    existingId?: string,
    subTaskId?: string | null,
    startTime?: string | null,
    endTime?: string | null
  ) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CalendarDayView({
  selectedDate,
  entries,
  tasks,
  onDateChange,
  onSaveEntry,
  onDeleteEntry,
}: CalendarDayViewProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    startHour: number;
    endHour: number;
    active: boolean;
  } | null>(null);
  const [createForm, setCreateForm] = useState<{
    startTime: string;
    endTime: string;
    taskId: string;
    category: string;
    description: string;
  } | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    startTime: string;
    endTime: string;
    category: string;
    description: string;
  } | null>(null);

  const dateStr = formatLocalDate(selectedDate);

  // Filter entries for the selected date
  const dayEntries = useMemo(
    () => entries.filter((e) => e.date.split("T")[0] === dateStr),
    [entries, dateStr]
  );

  // Split entries into scheduled (with start/end time) and unscheduled
  const scheduledEntries = useMemo(
    () => dayEntries.filter((e) => e.startTime && e.endTime),
    [dayEntries]
  );
  const unscheduledEntries = useMemo(
    () => dayEntries.filter((e) => !e.startTime || !e.endTime),
    [dayEntries]
  );

  const totalHours = dayEntries.reduce((sum, e) => sum + e.hours, 0);

  // ─── Day Navigation ─────────────────────────────────────────────────────────

  const goToPrevDay = useCallback(() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    onDateChange(d);
  }, [selectedDate, onDateChange]);

  const goToNextDay = useCallback(() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    onDateChange(d);
  }, [selectedDate, onDateChange]);

  const goToToday = useCallback(() => {
    onDateChange(new Date());
  }, [onDateChange]);

  const dayOfWeek = ["日", "一", "二", "三", "四", "五", "六"][selectedDate.getDay()];
  const dateLabel = `${selectedDate.getFullYear()}/${(selectedDate.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${selectedDate.getDate().toString().padStart(2, "0")}（${dayOfWeek}）`;

  // ─── Drag to Create ─────────────────────────────────────────────────────────

  const getHourFromY = useCallback((clientY: number): number => {
    if (!gridRef.current) return MIN_HOUR;
    const rect = gridRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    const hour = MIN_HOUR + y / HOUR_HEIGHT;
    return Math.max(MIN_HOUR, Math.min(MAX_HOUR, snapToGrid(hour)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only on the grid background, not on existing blocks
      if ((e.target as HTMLElement).closest("[data-time-block]")) return;
      const hour = getHourFromY(e.clientY);
      setDragState({ startHour: hour, endHour: hour, active: true });
      setCreateForm(null);
      setEditingEntryId(null);
    },
    [getHourFromY]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState?.active) return;
      const hour = getHourFromY(e.clientY);
      setDragState((prev) => (prev ? { ...prev, endHour: hour } : null));
    },
    [dragState?.active, getHourFromY]
  );

  const handleMouseUp = useCallback(() => {
    if (!dragState?.active) return;
    const start = Math.min(dragState.startHour, dragState.endHour);
    const end = Math.max(dragState.startHour, dragState.endHour);
    const duration = end - start;

    if (duration >= 0.25) {
      // At least 15 minutes
      setCreateForm({
        startTime: hoursToTime(start),
        endTime: hoursToTime(end),
        taskId: "",
        category: "PLANNED_TASK",
        description: "",
      });
    }
    setDragState(null);
  }, [dragState]);

  // ─── Click on Empty Area → Quick Create ─────────────────────────────────────

  const handleGridClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-time-block]")) return;
      if (dragState) return;
      // Only on single click (not after drag)
      const hour = getHourFromY(e.clientY);
      const startTime = hoursToTime(snapToGrid(hour));
      const endHour = snapToGrid(hour) + 1;
      const endTime = hoursToTime(Math.min(endHour, MAX_HOUR));
      setCreateForm({
        startTime,
        endTime,
        taskId: "",
        category: "PLANNED_TASK",
        description: "",
      });
      setEditingEntryId(null);
    },
    [dragState, getHourFromY]
  );

  // ─── Save create form ───────────────────────────────────────────────────────

  async function handleCreateSave() {
    if (!createForm) return;
    const startH = timeToHours(createForm.startTime);
    const endH = timeToHours(createForm.endTime);
    const hours = endH - startH;
    if (hours <= 0) return;

    await onSaveEntry(
      createForm.taskId || null,
      dateStr,
      hours,
      createForm.category,
      createForm.description,
      "NONE",
      undefined,
      null,
      createForm.startTime,
      createForm.endTime
    );
    setCreateForm(null);
  }

  // ─── Edit existing entry ────────────────────────────────────────────────────

  function handleBlockClick(entry: TimeEntry) {
    if (entry.locked) return;
    setEditingEntryId(entry.id);
    setEditForm({
      startTime: entry.startTime ?? "",
      endTime: entry.endTime ?? "",
      category: entry.category,
      description: entry.description ?? "",
    });
    setCreateForm(null);
  }

  async function handleEditSave() {
    if (!editForm || !editingEntryId) return;
    const entry = dayEntries.find((e) => e.id === editingEntryId);
    if (!entry) return;

    const startH = timeToHours(editForm.startTime);
    const endH = timeToHours(editForm.endTime);
    const hours = endH - startH;
    if (hours <= 0) return;

    await onSaveEntry(
      entry.taskId,
      dateStr,
      hours,
      editForm.category,
      editForm.description,
      (entry.overtimeType as OvertimeType) ?? "NONE",
      entry.id,
      entry.subTaskId ?? null,
      editForm.startTime,
      editForm.endTime
    );
    setEditingEntryId(null);
    setEditForm(null);
  }

  async function handleEditDelete() {
    if (!editingEntryId) return;
    await onDeleteEntry(editingEntryId);
    setEditingEntryId(null);
    setEditForm(null);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3" data-testid="calendar-day-view">
      {/* Day Navigation */}
      <div className="flex items-center justify-between" data-testid="day-nav">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevDay}
            className="p-1.5 hover:bg-accent rounded-md transition-colors"
            data-testid="prev-day-btn"
            aria-label="前一天"
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid="today-btn"
          >
            今天
          </button>
          <button
            onClick={goToNextDay}
            className="p-1.5 hover:bg-accent rounded-md transition-colors"
            data-testid="next-day-btn"
            aria-label="下一天"
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="text-sm font-medium text-foreground" data-testid="day-label">
          {dateLabel}
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          合計：{safeFixed(totalHours, 1)}h
        </div>
      </div>

      {/* Unscheduled entries section */}
      {unscheduledEntries.length > 0 && (
        <div className="border border-dashed border-border rounded-lg p-3" data-testid="unscheduled-section">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            未排程（{unscheduledEntries.length}）
          </div>
          <div className="flex flex-wrap gap-2">
            {unscheduledEntries.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs",
                  getCatBg(entry.category)
                )}
                data-testid="unscheduled-entry"
              >
                <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", getCatColor(entry.category))} />
                <span className="truncate max-w-[120px]">
                  {entry.task?.title ?? "自由工時"}
                </span>
                <span className="text-muted-foreground tabular-nums">{safeFixed(entry.hours, 1)}h</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div
          ref={gridRef}
          className="relative select-none"
          style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            if (dragState?.active) handleMouseUp();
          }}
          data-testid="time-grid"
        >
          {/* Hour lines */}
          {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
            const hour = MIN_HOUR + i;
            return (
              <div
                key={hour}
                className="absolute left-0 right-0 flex items-start"
                style={{ top: i * HOUR_HEIGHT }}
                data-testid={`hour-line-${hour}`}
              >
                <div className="w-14 flex-shrink-0 text-[10px] text-muted-foreground/60 text-right pr-2 -translate-y-1/2 tabular-nums">
                  {hour.toString().padStart(2, "0")}:00
                </div>
                <div className="flex-1 border-t border-border/40" />
              </div>
            );
          })}

          {/* Scheduled time blocks */}
          {scheduledEntries.map((entry) => {
            const startH = timeToHours(entry.startTime!);
            const endH = timeToHours(entry.endTime!);
            const top = (startH - MIN_HOUR) * HOUR_HEIGHT;
            const height = (endH - startH) * HOUR_HEIGHT;
            const isEditing = editingEntryId === entry.id;

            return (
              <div
                key={entry.id}
                data-time-block
                data-testid="time-block"
                className={cn(
                  "absolute left-14 right-2 rounded-md border px-2 py-1 cursor-pointer transition-all overflow-hidden",
                  getCatBg(entry.category),
                  isEditing && "ring-2 ring-ring z-20"
                )}
                style={{ top, height: Math.max(height, 24) }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleBlockClick(entry);
                }}
              >
                <div className="text-xs font-medium truncate">
                  {entry.task?.title ?? "自由工時"}
                </div>
                {height >= 40 && (
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {entry.startTime} — {entry.endTime} ({formatDuration(entry.hours)})
                  </div>
                )}
                {height >= 56 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={cn("w-1.5 h-1.5 rounded-full", getCatColor(entry.category))} />
                    <span className="text-[10px] text-muted-foreground">
                      {CATEGORIES.find((c) => c.value === entry.category)?.label}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Drag preview */}
          {dragState && dragState.active && (
            <div
              className="absolute left-14 right-2 bg-blue-500/20 border border-blue-500/40 rounded-md pointer-events-none z-10"
              style={{
                top: (Math.min(dragState.startHour, dragState.endHour) - MIN_HOUR) * HOUR_HEIGHT,
                height:
                  Math.abs(dragState.endHour - dragState.startHour) * HOUR_HEIGHT || HOUR_HEIGHT * 0.25,
              }}
              data-testid="drag-preview"
            >
              <div className="px-2 py-1 text-xs text-blue-400 tabular-nums">
                {hoursToTime(Math.min(dragState.startHour, dragState.endHour))} —{" "}
                {hoursToTime(Math.max(dragState.startHour, dragState.endHour))}
              </div>
            </div>
          )}

          {/* Current time indicator */}
          <CurrentTimeIndicator selectedDate={selectedDate} />
        </div>
      </div>

      {/* Create form popover */}
      {createForm && (
        <div
          className="border border-border rounded-xl bg-card shadow-lg p-4 space-y-3"
          data-testid="create-form"
        >
          <div className="text-sm font-medium">新增工時紀錄</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">開始時間</label>
              <input
                type="time"
                value={createForm.startTime}
                onChange={(e) => setCreateForm((f) => f ? { ...f, startTime: e.target.value } : null)}
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                data-testid="create-start-time"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">結束時間</label>
              <input
                type="time"
                value={createForm.endTime}
                onChange={(e) => setCreateForm((f) => f ? { ...f, endTime: e.target.value } : null)}
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                data-testid="create-end-time"
              />
            </div>
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            時長：{formatDuration(Math.max(0, timeToHours(createForm.endTime) - timeToHours(createForm.startTime)))}
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">任務</label>
            <select
              value={createForm.taskId}
              onChange={(e) => setCreateForm((f) => f ? { ...f, taskId: e.target.value } : null)}
              className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              data-testid="create-task-select"
            >
              <option value="">自由工時（無任務）</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">分類</label>
            <select
              value={createForm.category}
              onChange={(e) => setCreateForm((f) => f ? { ...f, category: e.target.value } : null)}
              className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              data-testid="create-category-select"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">備註</label>
            <input
              type="text"
              value={createForm.description}
              onChange={(e) => setCreateForm((f) => f ? { ...f, description: e.target.value } : null)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateSave();
                if (e.key === "Escape") setCreateForm(null);
              }}
              className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="可選備註..."
              data-testid="create-description"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateSave}
              className="flex-1 bg-accent hover:bg-accent/80 text-accent-foreground text-xs font-medium py-2 rounded-md transition-colors"
              data-testid="create-save-btn"
            >
              儲存
            </button>
            <button
              onClick={() => setCreateForm(null)}
              className="px-3 py-2 text-muted-foreground hover:text-foreground text-xs rounded-md transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Edit form popover */}
      {editingEntryId && editForm && (
        <div
          className="border border-border rounded-xl bg-card shadow-lg p-4 space-y-3"
          data-testid="edit-form"
        >
          <div className="text-sm font-medium">編輯工時紀錄</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">開始時間</label>
              <input
                type="time"
                value={editForm.startTime}
                onChange={(e) => setEditForm((f) => f ? { ...f, startTime: e.target.value } : null)}
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                data-testid="edit-start-time"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">結束時間</label>
              <input
                type="time"
                value={editForm.endTime}
                onChange={(e) => setEditForm((f) => f ? { ...f, endTime: e.target.value } : null)}
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                data-testid="edit-end-time"
              />
            </div>
          </div>
          {editForm.startTime && editForm.endTime && (
            <div className="text-xs text-muted-foreground tabular-nums">
              時長：{formatDuration(Math.max(0, timeToHours(editForm.endTime) - timeToHours(editForm.startTime)))}
            </div>
          )}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">分類</label>
            <select
              value={editForm.category}
              onChange={(e) => setEditForm((f) => f ? { ...f, category: e.target.value } : null)}
              className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">備註</label>
            <input
              type="text"
              value={editForm.description}
              onChange={(e) => setEditForm((f) => f ? { ...f, description: e.target.value } : null)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEditSave();
                if (e.key === "Escape") {
                  setEditingEntryId(null);
                  setEditForm(null);
                }
              }}
              className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="可選備註..."
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleEditSave}
              className="flex-1 bg-accent hover:bg-accent/80 text-accent-foreground text-xs font-medium py-2 rounded-md transition-colors"
              data-testid="edit-save-btn"
            >
              儲存
            </button>
            <button
              onClick={handleEditDelete}
              className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded-md transition-colors"
              data-testid="edit-delete-btn"
            >
              刪除
            </button>
            <button
              onClick={() => {
                setEditingEntryId(null);
                setEditForm(null);
              }}
              className="px-3 py-2 text-muted-foreground hover:text-foreground text-xs rounded-md transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Mobile: simplified list view */}
      <div className="sm:hidden space-y-2" data-testid="mobile-time-list">
        {dayEntries.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-6">
            今天尚無工時紀錄
          </div>
        ) : (
          dayEntries.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg border",
                getCatBg(entry.category)
              )}
            >
              <span className={cn("w-2 h-2 rounded-full flex-shrink-0", getCatColor(entry.category))} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {entry.task?.title ?? "自由工時"}
                </div>
                {entry.startTime && entry.endTime && (
                  <div className="text-xs text-muted-foreground tabular-nums">
                    <Clock className="inline h-3 w-3 mr-0.5" />
                    {entry.startTime} — {entry.endTime}
                  </div>
                )}
              </div>
              <span className="text-sm font-medium tabular-nums">{safeFixed(entry.hours, 1)}h</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Current Time Indicator ───────────────────────────────────────────────────

function CurrentTimeIndicator({ selectedDate }: { selectedDate: Date }) {
  const now = new Date();
  const isToday =
    now.getFullYear() === selectedDate.getFullYear() &&
    now.getMonth() === selectedDate.getMonth() &&
    now.getDate() === selectedDate.getDate();

  if (!isToday) return null;

  const currentHour = now.getHours() + now.getMinutes() / 60;
  if (currentHour < MIN_HOUR || currentHour > MAX_HOUR) return null;

  const top = (currentHour - MIN_HOUR) * HOUR_HEIGHT;

  return (
    <div
      className="absolute left-12 right-0 flex items-center z-10 pointer-events-none"
      style={{ top }}
      data-testid="current-time-indicator"
    >
      <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
      <div className="flex-1 border-t border-red-500" />
    </div>
  );
}

export { timeToHours, hoursToTime, formatDuration, HOUR_HEIGHT, MIN_HOUR, MAX_HOUR };
