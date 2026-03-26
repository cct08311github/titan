"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { safeFixed } from "@/lib/safe-number";
import { type TimeEntry, type OvertimeType, type TaskOption } from "../use-timesheet";
import { formatLocalDate } from "@/lib/utils/date";
import {
  HOUR_HEIGHT,
  MIN_HOUR,
  MAX_HOUR,
  TOTAL_HOURS,
  timeToHours,
  hoursToTime,
  snapToGrid,
} from "../calendar-utils";

import { WeekHeader } from "./week-header";
import { DayColumnHeader } from "./day-column-header";
import { DayColumn, type DragCreateState } from "./day-column";
import { EntryForm, type EntryFormData } from "./entry-form";
import { CopyDayMenu, type CopyMenuState, DAY_LABELS } from "./copy-day-menu";

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

type DragMoveState = {
  entryId: string;
  originDayIndex: number;
  currentDayIndex: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDayDateStr(weekStart: Date, dayIndex: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayIndex);
  return formatLocalDate(d);
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

  const [createForm, setCreateForm] = useState<{
    dayIndex: number;
    startTime: string;
    endTime: string;
    taskId: string;
    category: string;
    description: string;
  } | null>(null);

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EntryFormData | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ─── Derived ──────────────────────────────────────────────────────────────

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

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

  const dailyTotals = useMemo(
    () => Array.from({ length: 7 }, (_, i) => (entriesByDay.get(i) ?? []).reduce((s, e) => s + e.hours, 0)),
    [entriesByDay]
  );
  const weeklyTotal = useMemo(() => dailyTotals.reduce((s, v) => s + v, 0), [dailyTotals]);

  // ─── Drag to Create ──────────────────────────────────────────────────────

  const getHourFromY = useCallback((el: HTMLDivElement, clientY: number): number => {
    const rect = el.getBoundingClientRect();
    const y = clientY - rect.top;
    return Math.max(MIN_HOUR, Math.min(MAX_HOUR, snapToGrid(MIN_HOUR + y / HOUR_HEIGHT)));
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
      setDragCreate((prev) => (prev ? { ...prev, endHour: getHourFromY(col, e.clientY) } : null));
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

  // ─── Block click → edit ──────────────────────────────────────────────────

  const handleBlockClick = useCallback((entry: TimeEntry, e: React.MouseEvent) => {
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
  }, []);

  // ─── Block drag → move ───────────────────────────────────────────────────

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
      if (!targetDate || entry.date.split("T")[0] === targetDate) return;
      await onSaveEntry(entry.taskId, targetDate, entry.hours, entry.category, entry.description ?? "",
        (entry.overtimeType as OvertimeType) ?? "NONE", entry.id, entry.subTaskId ?? null, entry.startTime ?? null, entry.endTime ?? null);
    },
    [entries, weekDates, onSaveEntry]
  );

  // ─── Copy Day ────────────────────────────────────────────────────────────

  const handleDayHeaderContextMenu = useCallback((dayIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    setCopyMenu({ sourceDayIndex: dayIndex, x: e.clientX, y: e.clientY });
  }, []);

  const handleCopyDayTo = useCallback(
    async (targetDayIndex: number) => {
      if (copyMenu === null) return;
      const sourceEntries = entriesByDay.get(copyMenu.sourceDayIndex) ?? [];
      const targetDate = weekDates[targetDayIndex];
      if (!targetDate) return;
      for (const entry of sourceEntries) {
        await onSaveEntry(entry.taskId, targetDate, entry.hours, entry.category, entry.description ?? "",
          "NONE", undefined, entry.subTaskId ?? null, entry.startTime ?? null, entry.endTime ?? null);
      }
      setCopyMenu(null);
    },
    [copyMenu, entriesByDay, weekDates, onSaveEntry]
  );

  useEffect(() => {
    if (!copyMenu) return;
    const h = () => setCopyMenu(null);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [copyMenu]);

  // ─── Save / Delete ────────────────────────────────────────────────────────

  async function handleCreateSave() {
    if (!createForm) return;
    const hours = timeToHours(createForm.endTime) - timeToHours(createForm.startTime);
    if (hours <= 0) return;
    await onSaveEntry(createForm.taskId || null, weekDates[createForm.dayIndex], hours, createForm.category,
      createForm.description, "NONE", undefined, null, createForm.startTime, createForm.endTime);
    setCreateForm(null);
  }

  async function handleEditSave() {
    if (!editForm || !editingEntryId) return;
    const entry = entries.find((e) => e.id === editingEntryId);
    if (!entry) return;
    const hours = timeToHours(editForm.endTime) - timeToHours(editForm.startTime);
    if (hours <= 0) return;
    await onSaveEntry(entry.taskId, entry.date.split("T")[0], hours, editForm.category, editForm.description,
      (entry.overtimeType as OvertimeType) ?? "NONE", entry.id, entry.subTaskId ?? null, editForm.startTime, editForm.endTime);
    setEditingEntryId(null);
    setEditForm(null);
  }

  async function handleEditDelete() {
    if (!editingEntryId) return;
    await onDeleteEntry(editingEntryId);
    setEditingEntryId(null);
    setEditForm(null);
  }

  // ─── Mobile fallback ─────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-muted-foreground gap-2" data-testid="week-view-mobile-fallback">
        <p>週檢視在手機上空間不足</p>
        <p className="text-xs">請切換至日曆（日）或列表模式</p>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3" data-testid="calendar-week-view">
      <WeekHeader weekDates={weekDates} weeklyTotal={weeklyTotal} onPrevWeek={onPrevWeek} onNextWeek={onNextWeek} onThisWeek={onThisWeek} />

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        {/* Header row */}
        <div className="grid border-b border-border" style={{ gridTemplateColumns: "80px repeat(7, 1fr)" }} data-testid="week-header">
          <div className="p-2 text-[10px] text-muted-foreground/60 border-r border-border" />
          {weekDates.map((dateStr, i) => (
            <DayColumnHeader key={dateStr} dateStr={dateStr} dayIndex={i} weekStart={weekStart} dailyTotal={dailyTotals[i]} onContextMenu={handleDayHeaderContextMenu} />
          ))}
        </div>

        {/* Grid body */}
        <div className="grid" style={{ gridTemplateColumns: "80px repeat(7, 1fr)" }} data-testid="week-grid-body">
          {/* Time labels */}
          <div className="relative border-r border-border" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
            {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
              <div key={i} className="absolute left-0 right-0 text-[10px] text-muted-foreground/60 text-right pr-2 -translate-y-1/2 tabular-nums" style={{ top: i * HOUR_HEIGHT }}>
                {(MIN_HOUR + i).toString().padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* 7 day columns */}
          {weekDates.map((dateStr, dayIndex) => (
            <DayColumn
              key={dateStr}
              dayIndex={dayIndex}
              dateStr={dateStr}
              entries={entriesByDay.get(dayIndex) ?? []}
              isWeekend={dayIndex >= 5}
              isDragTarget={dragMove?.currentDayIndex === dayIndex}
              dragCreate={dragCreate}
              editingEntryId={editingEntryId}
              columnRef={(el) => { columnRefs.current[dayIndex] = el; }}
              onMouseDown={handleColumnMouseDown}
              onMouseMove={handleColumnMouseMove}
              onMouseUp={handleColumnMouseUp}
              onDragOver={handleColumnDragOver}
              onDrop={handleColumnDrop}
              onBlockClick={handleBlockClick}
              onBlockDragStart={handleBlockDragStart}
            />
          ))}
        </div>

        {/* Totals row */}
        <div className="grid border-t border-border" style={{ gridTemplateColumns: "80px repeat(7, 1fr)" }} data-testid="week-totals-row">
          <div className="p-2 text-[10px] text-muted-foreground font-medium text-right pr-2">合計</div>
          {dailyTotals.map((total, i) => (
            <div key={i} className="p-2 text-center text-xs tabular-nums border-r border-border last:border-r-0" data-testid={`day-total-cell-${i}`}>
              {total > 0 ? `${safeFixed(total, 1)}h` : "--"}
            </div>
          ))}
        </div>
      </div>

      {/* Copy Day Menu */}
      {copyMenu && <CopyDayMenu menu={copyMenu} weekStart={weekStart} onCopyTo={handleCopyDayTo} onClose={() => setCopyMenu(null)} />}

      {/* Create Form */}
      {createForm && (
        <EntryForm
          mode="create"
          dayIndex={createForm.dayIndex}
          dateStr={weekDates[createForm.dayIndex]}
          form={{ startTime: createForm.startTime, endTime: createForm.endTime, taskId: createForm.taskId, category: createForm.category, description: createForm.description }}
          tasks={tasks}
          onFormChange={(u) => setCreateForm((f) => f ? { ...f, ...u } : null)}
          onSave={handleCreateSave}
          onCancel={() => setCreateForm(null)}
        />
      )}

      {/* Edit Form */}
      {editingEntryId && editForm && (
        <EntryForm
          mode="edit"
          form={editForm}
          tasks={tasks}
          onFormChange={(u) => setEditForm((f) => f ? { ...f, ...u } : null)}
          onSave={handleEditSave}
          onDelete={handleEditDelete}
          onCancel={() => { setEditingEntryId(null); setEditForm(null); }}
        />
      )}
    </div>
  );
}
