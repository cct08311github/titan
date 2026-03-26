"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { safeFixed, safeNum } from "@/lib/safe-number";
import { type TimeEntry, type OvertimeType, type TaskOption } from "./use-timesheet";
import { CATEGORIES } from "./timesheet-cell";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { formatLocalDate } from "@/lib/utils/date";
import {
  HOUR_HEIGHT,
  MIN_HOUR,
  MAX_HOUR,
  TOTAL_HOURS,
  SNAP_MINUTES,
  timeToHours,
  hoursToTime,
  snapToGrid,
  formatDuration,
  getBlockStyle,
  getCatColor,
  getCatBg,
} from "./calendar-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type CalendarWeekViewProps = {
  weekStart: Date;
  entries: TimeEntry[];
  tasks: TaskOption[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onThisWeek: () => void;
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

type DragCreateState = {
  dayIndex: number;
  startHour: number;
  endHour: number;
  active: boolean;
};

type DragMoveState = {
  entryId: string;
  originDayIndex: number;
  currentDayIndex: number;
};

type CopyMenuState = {
  sourceDayIndex: number;
  x: number;
  y: number;
};

// ─── Day helpers ─────────────────────────────────────────────────────────────

const DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function getDayDate(weekStart: Date, dayIndex: number): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayIndex);
  return d;
}

function getDayDateStr(weekStart: Date, dayIndex: number): string {
  return formatLocalDate(getDayDate(weekStart, dayIndex));
}

function getWeekDates(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => getDayDateStr(weekStart, i));
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CalendarWeekView({
  weekStart,
  entries,
  tasks,
  onPrevWeek,
  onNextWeek,
  onThisWeek,
  onSaveEntry,
  onDeleteEntry,
}: CalendarWeekViewProps) {
  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [dragCreate, setDragCreate] = useState<DragCreateState | null>(null);
  const [dragMove, setDragMove] = useState<DragMoveState | null>(null);
  const [copyMenu, setCopyMenu] = useState<CopyMenuState | null>(null);

  // Create / edit form state
  const [createForm, setCreateForm] = useState<{
    dayIndex: number;
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

  // Mobile: detect small screen and fall back to single-day swipe
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ─── Derived data ──────────────────────────────────────────────────────────

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  /** Entries grouped by day index (0=Mon … 6=Sun). */
  const entriesByDay = useMemo(() => {
    const map = new Map<number, TimeEntry[]>();
    for (let i = 0; i < 7; i++) map.set(i, []);
    for (const e of entries) {
      const dateStr = e.date.split("T")[0];
      const idx = weekDates.indexOf(dateStr);
      if (idx >= 0) map.get(idx)!.push(e);
    }
    return map;
  }, [entries, weekDates]);

  /** Daily totals. */
  const dailyTotals = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const dayEntries = entriesByDay.get(i) ?? [];
      return dayEntries.reduce((s, e) => s + e.hours, 0);
    });
  }, [entriesByDay]);

  const weeklyTotal = useMemo(() => dailyTotals.reduce((s, v) => s + v, 0), [dailyTotals]);

  // ─── Drag to Create ────────────────────────────────────────────────────────

  const getHourFromY = useCallback((el: HTMLDivElement, clientY: number): number => {
    const rect = el.getBoundingClientRect();
    const y = clientY - rect.top;
    const hour = MIN_HOUR + y / HOUR_HEIGHT;
    return Math.max(MIN_HOUR, Math.min(MAX_HOUR, snapToGrid(hour)));
  }, []);

  const handleColumnMouseDown = useCallback(
    (dayIndex: number, e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-time-block]")) return;
      const col = columnRefs.current[dayIndex];
      if (!col) return;
      const hour = getHourFromY(col, e.clientY);
      setDragCreate({ dayIndex, startHour: hour, endHour: hour, active: true });
      setCreateForm(null);
      setEditingEntryId(null);
      setCopyMenu(null);
    },
    [getHourFromY]
  );

  const handleColumnMouseMove = useCallback(
    (dayIndex: number, e: React.MouseEvent) => {
      if (!dragCreate?.active || dragCreate.dayIndex !== dayIndex) return;
      const col = columnRefs.current[dayIndex];
      if (!col) return;
      const hour = getHourFromY(col, e.clientY);
      setDragCreate((prev) => (prev ? { ...prev, endHour: hour } : null));
    },
    [dragCreate, getHourFromY]
  );

  const handleColumnMouseUp = useCallback(
    (dayIndex: number) => {
      if (!dragCreate?.active || dragCreate.dayIndex !== dayIndex) return;
      const start = Math.min(dragCreate.startHour, dragCreate.endHour);
      const end = Math.max(dragCreate.startHour, dragCreate.endHour);
      if (end - start >= 0.25) {
        setCreateForm({
          dayIndex,
          startTime: hoursToTime(start),
          endTime: hoursToTime(end),
          taskId: "",
          category: "PLANNED_TASK",
          description: "",
        });
      }
      setDragCreate(null);
    },
    [dragCreate]
  );

  // ─── Block click → edit ────────────────────────────────────────────────────

  function handleBlockClick(entry: TimeEntry, e: React.MouseEvent) {
    e.stopPropagation();
    if (entry.locked) return;
    setEditingEntryId(entry.id);
    setEditForm({
      startTime: entry.startTime ?? "",
      endTime: entry.endTime ?? "",
      category: entry.category,
      description: entry.description ?? "",
    });
    setCreateForm(null);
    setCopyMenu(null);
  }

  // ─── Block drag → move between days ────────────────────────────────────────

  const handleBlockDragStart = useCallback(
    (entryId: string, dayIndex: number, e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", entryId);
      e.dataTransfer.effectAllowed = "move";
      setDragMove({ entryId, originDayIndex: dayIndex, currentDayIndex: dayIndex });
    },
    []
  );

  const handleColumnDragOver = useCallback((dayIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragMove((prev) => (prev ? { ...prev, currentDayIndex: dayIndex } : null));
  }, []);

  const handleColumnDrop = useCallback(
    async (dayIndex: number, e: React.DragEvent) => {
      e.preventDefault();
      const entryId = e.dataTransfer.getData("text/plain");
      if (!entryId) return;
      setDragMove(null);

      const entry = entries.find((en) => en.id === entryId);
      if (!entry || entry.locked) return;

      const targetDate = weekDates[dayIndex];
      if (!targetDate) return;
      const sourceDate = entry.date.split("T")[0];
      if (sourceDate === targetDate) return;

      // Move entry to the target day by saving with updated date
      await onSaveEntry(
        entry.taskId,
        targetDate,
        entry.hours,
        entry.category,
        entry.description ?? "",
        (entry.overtimeType as OvertimeType) ?? "NONE",
        entry.id,
        entry.subTaskId ?? null,
        entry.startTime ?? null,
        entry.endTime ?? null
      );
    },
    [entries, weekDates, onSaveEntry]
  );

  // ─── Copy Day (right-click context menu) ───────────────────────────────────

  const handleDayHeaderContextMenu = useCallback(
    (dayIndex: number, e: React.MouseEvent) => {
      e.preventDefault();
      setCopyMenu({ sourceDayIndex: dayIndex, x: e.clientX, y: e.clientY });
    },
    []
  );

  const handleCopyDayTo = useCallback(
    async (targetDayIndex: number) => {
      if (copyMenu === null) return;
      const sourceEntries = entriesByDay.get(copyMenu.sourceDayIndex) ?? [];
      const targetDate = weekDates[targetDayIndex];
      if (!targetDate) return;

      for (const entry of sourceEntries) {
        await onSaveEntry(
          entry.taskId,
          targetDate,
          entry.hours,
          entry.category,
          entry.description ?? "",
          "NONE",
          undefined,
          entry.subTaskId ?? null,
          entry.startTime ?? null,
          entry.endTime ?? null
        );
      }
      setCopyMenu(null);
    },
    [copyMenu, entriesByDay, weekDates, onSaveEntry]
  );

  // Close copy menu on outside click
  useEffect(() => {
    if (!copyMenu) return;
    const handleClick = () => setCopyMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [copyMenu]);

  // ─── Save / Delete handlers ────────────────────────────────────────────────

  async function handleCreateSave() {
    if (!createForm) return;
    const startH = timeToHours(createForm.startTime);
    const endH = timeToHours(createForm.endTime);
    const hours = endH - startH;
    if (hours <= 0) return;

    const dateStr = weekDates[createForm.dayIndex];
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

  async function handleEditSave() {
    if (!editForm || !editingEntryId) return;
    const entry = entries.find((e) => e.id === editingEntryId);
    if (!entry) return;

    const startH = timeToHours(editForm.startTime);
    const endH = timeToHours(editForm.endTime);
    const hours = endH - startH;
    if (hours <= 0) return;

    await onSaveEntry(
      entry.taskId,
      entry.date.split("T")[0],
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

  // ─── Mobile fallback: show message to switch view ──────────────────────────

  if (isMobile) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 text-center text-sm text-muted-foreground gap-2"
        data-testid="week-view-mobile-fallback"
      >
        <p>週檢視在手機上空間不足</p>
        <p className="text-xs">請切換至日曆（日）或列表模式</p>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3" data-testid="calendar-week-view">
      {/* Week Navigation (reused from toolbar but also local for sub-tab) */}
      <div className="flex items-center justify-between" data-testid="week-nav">
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevWeek}
            className="p-1.5 hover:bg-accent rounded-md transition-colors"
            data-testid="prev-week-btn"
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={onThisWeek}
            className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid="this-week-btn"
          >
            本週
          </button>
          <button
            onClick={onNextWeek}
            className="p-1.5 hover:bg-accent rounded-md transition-colors"
            data-testid="next-week-btn"
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="text-sm font-medium text-foreground" data-testid="week-range-label">
          {weekDates[0]} — {weekDates[6]}
        </div>
        <div className="text-xs text-muted-foreground tabular-nums" data-testid="weekly-total">
          週合計：{safeFixed(weeklyTotal, 1)}h
        </div>
      </div>

      {/* Week Grid */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        {/* Header row: time label + 7 day columns */}
        <div
          className="grid border-b border-border"
          style={{ gridTemplateColumns: "80px repeat(7, 1fr)" }}
          data-testid="week-header"
        >
          {/* Top-left corner */}
          <div className="p-2 text-[10px] text-muted-foreground/60 border-r border-border" />
          {/* Day headers */}
          {weekDates.map((dateStr, i) => {
            const d = getDayDate(weekStart, i);
            const isWeekend = i >= 5;
            const isToday = formatLocalDate(new Date()) === dateStr;
            return (
              <div
                key={dateStr}
                className={cn(
                  "p-2 text-center border-r border-border last:border-r-0 cursor-context-menu",
                  isWeekend && "bg-muted/30",
                  isToday && "bg-accent/20"
                )}
                onContextMenu={(e) => handleDayHeaderContextMenu(i, e)}
                data-testid={`day-header-${i}`}
              >
                <div className={cn("text-xs font-medium", isToday && "text-foreground")}>
                  週{DAY_LABELS[i]}
                </div>
                <div className={cn(
                  "text-[10px] tabular-nums",
                  isToday ? "text-foreground font-medium" : "text-muted-foreground"
                )}>
                  {d.getMonth() + 1}/{d.getDate()}
                </div>
                <div
                  className={cn(
                    "text-[10px] tabular-nums mt-0.5",
                    dailyTotals[i] > 8
                      ? "text-amber-500 font-medium"
                      : "text-muted-foreground/60"
                  )}
                  data-testid={`day-total-${i}`}
                >
                  {dailyTotals[i] > 0 ? `${safeFixed(dailyTotals[i], 1)}h` : "--"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time grid body */}
        <div
          className="grid"
          style={{ gridTemplateColumns: "80px repeat(7, 1fr)" }}
          data-testid="week-grid-body"
        >
          {/* Time labels column */}
          <div className="relative border-r border-border" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
            {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
              const hour = MIN_HOUR + i;
              return (
                <div
                  key={hour}
                  className="absolute left-0 right-0 text-[10px] text-muted-foreground/60 text-right pr-2 -translate-y-1/2 tabular-nums"
                  style={{ top: i * HOUR_HEIGHT }}
                >
                  {hour.toString().padStart(2, "0")}:00
                </div>
              );
            })}
          </div>

          {/* 7 day columns */}
          {weekDates.map((dateStr, dayIndex) => {
            const dayEntries = (entriesByDay.get(dayIndex) ?? []).filter(
              (e) => e.startTime && e.endTime
            );
            const isWeekend = dayIndex >= 5;
            const isDragTarget = dragMove?.currentDayIndex === dayIndex;

            return (
              <div
                key={dateStr}
                ref={(el) => { columnRefs.current[dayIndex] = el; }}
                className={cn(
                  "relative border-r border-border last:border-r-0 select-none",
                  isWeekend && "bg-muted/15",
                  isDragTarget && "bg-accent/10"
                )}
                style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
                data-testid={`day-column-${dayIndex}`}
                onMouseDown={(e) => handleColumnMouseDown(dayIndex, e)}
                onMouseMove={(e) => handleColumnMouseMove(dayIndex, e)}
                onMouseUp={() => handleColumnMouseUp(dayIndex)}
                onMouseLeave={() => {
                  if (dragCreate?.active && dragCreate.dayIndex === dayIndex) {
                    handleColumnMouseUp(dayIndex);
                  }
                }}
                onDragOver={(e) => handleColumnDragOver(dayIndex, e)}
                onDrop={(e) => handleColumnDrop(dayIndex, e)}
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
                      onDragStart={(e) => handleBlockDragStart(entry.id, dayIndex, e)}
                      className={cn(
                        "absolute left-0.5 right-0.5 rounded-sm border px-1 py-0.5 cursor-pointer transition-all overflow-hidden text-[10px]",
                        getCatBg(entry.category),
                        isEditing && "ring-2 ring-ring z-20"
                      )}
                      style={style}
                      onClick={(e) => handleBlockClick(entry, e)}
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
          })}
        </div>

        {/* Bottom totals row */}
        <div
          className="grid border-t border-border"
          style={{ gridTemplateColumns: "80px repeat(7, 1fr)" }}
          data-testid="week-totals-row"
        >
          <div className="p-2 text-[10px] text-muted-foreground font-medium text-right pr-2">
            合計
          </div>
          {dailyTotals.map((total, i) => (
            <div
              key={i}
              className={cn(
                "p-2 text-center text-xs tabular-nums border-r border-border last:border-r-0",
                total > 8 ? "text-amber-500 font-medium" : "text-muted-foreground"
              )}
              data-testid={`day-total-cell-${i}`}
            >
              {total > 0 ? `${safeFixed(total, 1)}h` : "--"}
            </div>
          ))}
        </div>
      </div>

      {/* Copy Day Context Menu */}
      {copyMenu && (
        <div
          className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[140px]"
          style={{ left: copyMenu.x, top: copyMenu.y }}
          data-testid="copy-day-menu"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border mb-1">
            複製週{DAY_LABELS[copyMenu.sourceDayIndex]}到...
          </div>
          {DAY_LABELS.map((label, i) => {
            if (i === copyMenu.sourceDayIndex) return null;
            return (
              <button
                key={i}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                onClick={() => handleCopyDayTo(i)}
                data-testid={`copy-to-day-${i}`}
              >
                週{label}（{getDayDate(weekStart, i).getDate()}日）
              </button>
            );
          })}
        </div>
      )}

      {/* Create form */}
      {createForm && (
        <div
          className="border border-border rounded-xl bg-card shadow-lg p-4 space-y-3"
          data-testid="week-create-form"
        >
          <div className="text-sm font-medium">
            新增工時 — 週{DAY_LABELS[createForm.dayIndex]}（{weekDates[createForm.dayIndex]}）
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">開始時間</label>
              <input
                type="time"
                value={createForm.startTime}
                onChange={(e) => setCreateForm((f) => f ? { ...f, startTime: e.target.value } : null)}
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                data-testid="week-create-start-time"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">結束時間</label>
              <input
                type="time"
                value={createForm.endTime}
                onChange={(e) => setCreateForm((f) => f ? { ...f, endTime: e.target.value } : null)}
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                data-testid="week-create-end-time"
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
              data-testid="week-create-task-select"
            >
              <option value="">自由工時（無任務）</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">分類</label>
            <select
              value={createForm.category}
              onChange={(e) => setCreateForm((f) => f ? { ...f, category: e.target.value } : null)}
              className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              data-testid="week-create-category-select"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
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
              data-testid="week-create-description"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateSave}
              className="flex-1 bg-accent hover:bg-accent/80 text-accent-foreground text-xs font-medium py-2 rounded-md transition-colors"
              data-testid="week-create-save-btn"
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

      {/* Edit form */}
      {editingEntryId && editForm && (
        <div
          className="border border-border rounded-xl bg-card shadow-lg p-4 space-y-3"
          data-testid="week-edit-form"
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
                data-testid="week-edit-start-time"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">結束時間</label>
              <input
                type="time"
                value={editForm.endTime}
                onChange={(e) => setEditForm((f) => f ? { ...f, endTime: e.target.value } : null)}
                className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                data-testid="week-edit-end-time"
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
                <option key={c.value} value={c.value}>{c.label}</option>
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
              data-testid="week-edit-save-btn"
            >
              儲存
            </button>
            <button
              onClick={handleEditDelete}
              className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded-md transition-colors"
              data-testid="week-edit-delete-btn"
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
    </div>
  );
}
