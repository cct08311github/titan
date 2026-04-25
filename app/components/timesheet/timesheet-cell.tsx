"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { type TimeEntry, type OvertimeType, type SubTaskOption } from "./use-timesheet";
import { safeFixed } from "@/lib/safe-number";
import { Lock } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

export const CATEGORIES = [
  { value: "PLANNED_TASK", label: "原始規劃", dot: "bg-blue-500" },
  { value: "ADDED_TASK", label: "追加任務", dot: "bg-purple-500" },
  { value: "INCIDENT", label: "突發事件", dot: "bg-red-500" },
  { value: "SUPPORT", label: "用戶支援", dot: "bg-orange-500" },
  { value: "ADMIN", label: "行政庶務", dot: "bg-slate-400" },
  { value: "LEARNING", label: "學習成長", dot: "bg-emerald-500" },
] as const;

const OVERTIME_OPTIONS: { value: OvertimeType; label: string; color: string }[] = [
  { value: "NONE", label: "非加班", color: "" },
  { value: "WEEKDAY", label: "平日加班", color: "bg-amber-500" },
  { value: "HOLIDAY", label: "假日加班", color: "bg-red-500" },
];

function getCatDot(cat: string) {
  return CATEGORIES.find((c) => c.value === cat)?.dot ?? "bg-slate-400";
}

const LOCKED_TOAST_MSG = "此記錄已核准鎖定，如需修改請聯繫主管";

// ─── Types ────────────────────────────────────────────────────────────────────

type TimesheetCellProps = {
  entries: TimeEntry[];
  taskId: string | null;
  date: string;
  subTasks?: SubTaskOption[];              // Issue #933
  onQuickSave: (taskId: string | null, date: string, hours: number, existingId?: string) => Promise<void>;
  onFullSave: (
    taskId: string | null,
    date: string,
    hours: number,
    category: string,
    description: string,
    overtimeType: OvertimeType,
    existingId?: string,
    subTaskId?: string | null,             // Issue #933
    startTime?: string | null,             // Issue #1008
    endTime?: string | null                // Issue #1008
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onNavigate?: (direction: "next" | "prev" | "up" | "down") => void;
  isWeekend?: boolean;
};

// ─── Per-entry edit state ─────────────────────────────────────────────────────

type EntryEditState = {
  hours: string;
  category: string;
  description: string;
  overtimeType: OvertimeType;
  subTaskId: string;                       // Issue #933: "" means no subtask
  startTime: string;                       // Issue #1008
  endTime: string;                         // Issue #1008
  saving: boolean;
};

// Issue #1008: auto-calculate hours from start/end time
function calculateHours(startTime: string, endTime: string): number | null {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) return null; // invalid range
  return Math.round(diff / 30) * 0.5; // round to nearest 0.5h
}

function initEditState(entry: TimeEntry): EntryEditState {
  return {
    hours: safeFixed(entry.hours, 1),
    category: entry.category,
    description: entry.description ?? "",
    overtimeType: (entry.overtimeType as OvertimeType) ?? "NONE",
    subTaskId: entry.subTaskId ?? "",      // Issue #933
    startTime: entry.startTime ?? "",      // Issue #1008
    endTime: entry.endTime ?? "",          // Issue #1008
    saving: false,
  };
}

// ─── Locked Toast ─────────────────────────────────────────────────────────────

function showLockedToast() {
  // Use a lightweight toast element appended to body
  const existing = document.getElementById("locked-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "locked-toast";
  toast.textContent = LOCKED_TOAST_MSG;
  toast.style.cssText =
    "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;" +
    "background:#292524;color:#fbbf24;border:1px solid rgba(251,191,36,0.3);" +
    "padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;" +
    "box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:opacity 0.3s;";
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TimesheetCell({
  entries,
  taskId,
  date,
  subTasks = [],
  onQuickSave,
  onFullSave,
  onDelete,
  onNavigate,
  isWeekend,
}: TimesheetCellProps) {
  const entry = entries[0] ?? null;
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const hasMultiple = entries.length > 1;

  // Check if ALL entries are locked (cell-level locked state)
  const allLocked = entries.length > 0 && entries.every((e) => e.locked);
  // Check if ANY entry is locked
  const hasLockedEntry = entries.some((e) => e.locked);

  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  // Guard against Enter+Blur double save (Item 5)
  const savedByKeyboard = useRef(false);

  // Per-entry expanded edit states (Item 7)
  const [entryStates, setEntryStates] = useState<Map<string, EntryEditState>>(new Map());
  // New entry form state
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newEntryState, setNewEntryState] = useState<EntryEditState>({
    hours: "",
    category: "PLANNED_TASK",
    description: "",
    overtimeType: "NONE",
    subTaskId: "",
    startTime: "",
    endTime: "",
    saving: false,
  });

  // Focus input when editing starts
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Close on outside click
  useEffect(() => {
    if (!expanded) return;
    function handler(e: MouseEvent) {
      if (cellRef.current && !cellRef.current.contains(e.target as Node)) {
        setExpanded(false);
        setShowNewEntry(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expanded]);

  // Handle click on cell — start inline editing
  const handleClick = useCallback(() => {
    if (expanded) return;
    // Item 2: locked protection — all entries locked = no inline edit
    if (allLocked) {
      showLockedToast();
      return;
    }
    setEditing(true);
    setInputValue(entry ? safeFixed(entry.hours, 1) : "");
  }, [entry, expanded, allLocked]);

  // Handle double-click — open expanded editor (Item 7: show ALL entries)
  const handleDoubleClick = useCallback(() => {
    // Allow opening expanded view even if locked (entries shown read-only)
    if (entries.length === 0) return;
    setEditing(false);
    setExpanded(true);
    // Initialize per-entry edit states
    const states = new Map<string, EntryEditState>();
    for (const e of entries) {
      states.set(e.id, initEditState(e));
    }
    setEntryStates(states);
    setShowNewEntry(false);
  }, [entries]);

  // Inline edit keyboard handler
  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        // Item 5: set flag to prevent duplicate save on blur
        savedByKeyboard.current = true;
        setTimeout(() => { savedByKeyboard.current = false; }, 150);
        const h = parseFloat(inputValue);
        if (!isNaN(h) && h >= 0) {
          if (h === 0 && entry) {
            if (entry.locked) {
              showLockedToast();
            } else {
              await onDelete(entry.id);
            }
          } else if (h > 0) {
            if (entry?.locked) {
              showLockedToast();
            } else {
              await onQuickSave(taskId, date, h, entry?.id);
            }
          }
        }
        setEditing(false);
        if (e.key === "Tab") {
          onNavigate?.(e.shiftKey ? "prev" : "next");
        }
      } else if (e.key === "Escape") {
        setEditing(false);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        onNavigate?.("up");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        onNavigate?.("down");
      }
    },
    [inputValue, entry, taskId, date, onQuickSave, onDelete, onNavigate]
  );

  // Handle blur on inline input
  // Item 5: skip save if already saved via keyboard (Enter/Tab)
  const handleBlur = useCallback(async () => {
    if (savedByKeyboard.current) {
      savedByKeyboard.current = false;
      return;
    }
    const h = parseFloat(inputValue);
    if (!isNaN(h) && h >= 0) {
      if (h === 0 && entry) {
        if (entry.locked) {
          showLockedToast();
        } else {
          await onDelete(entry.id);
        }
      } else if (h > 0) {
        if (entry?.locked) {
          showLockedToast();
        } else {
          await onQuickSave(taskId, date, h, entry?.id);
        }
      }
    }
    setEditing(false);
  }, [inputValue, entry, taskId, date, onQuickSave, onDelete]);

  // Per-entry expanded save (Item 7)
  async function handleEntrySave(entryId: string) {
    const state = entryStates.get(entryId);
    if (!state) return;
    // Issue #1008: use auto-calculated hours when start+end are set
    const autoH = calculateHours(state.startTime, state.endTime);
    const h = autoH ?? parseFloat(state.hours);
    if (isNaN(h) || h < 0) return;
    setEntryStates((prev) => {
      const next = new Map(prev);
      next.set(entryId, { ...state, saving: true });
      return next;
    });
    try {
      await onFullSave(taskId, date, h, state.category, state.description, state.overtimeType, entryId, state.subTaskId || null, state.startTime || null, state.endTime || null);
    } finally {
      setEntryStates((prev) => {
        const next = new Map(prev);
        const s = next.get(entryId);
        if (s) next.set(entryId, { ...s, saving: false });
        return next;
      });
    }
  }

  // Per-entry expanded delete (Item 7)
  async function handleEntryDelete(entryId: string) {
    const state = entryStates.get(entryId);
    if (!state) return;
    setEntryStates((prev) => {
      const next = new Map(prev);
      next.set(entryId, { ...state, saving: true });
      return next;
    });
    try {
      await onDelete(entryId);
      setEntryStates((prev) => {
        const next = new Map(prev);
        next.delete(entryId);
        return next;
      });
      // If no entries left, close expanded
      if (entryStates.size <= 1) {
        setExpanded(false);
      }
    } finally {
      setEntryStates((prev) => {
        const next = new Map(prev);
        const s = next.get(entryId);
        if (s) next.set(entryId, { ...s, saving: false });
        return next;
      });
    }
  }

  // Update a single entry's edit state field
  function updateEntryField(entryId: string, field: keyof EntryEditState, value: string) {
    setEntryStates((prev) => {
      const next = new Map(prev);
      const state = next.get(entryId);
      if (!state) return next;
      const updated = { ...state, [field]: value };
      // Issue #1008: auto-calculate hours when start/end time change
      if (field === "startTime" || field === "endTime") {
        const autoH = calculateHours(updated.startTime, updated.endTime);
        if (autoH !== null) updated.hours = safeFixed(autoH, 1);
      }
      next.set(entryId, updated);
      return next;
    });
  }

  // New entry save
  async function handleNewEntrySave() {
    // Issue #1008: use auto-calculated hours when start+end are set
    const autoH = calculateHours(newEntryState.startTime, newEntryState.endTime);
    const h = autoH ?? parseFloat(newEntryState.hours);
    if (isNaN(h) || h <= 0) return;
    setNewEntryState((s) => ({ ...s, saving: true }));
    try {
      await onFullSave(taskId, date, h, newEntryState.category, newEntryState.description, newEntryState.overtimeType, undefined, newEntryState.subTaskId || null, newEntryState.startTime || null, newEntryState.endTime || null);
      setShowNewEntry(false);
      setNewEntryState({
        hours: "",
        category: "PLANNED_TASK",
        description: "",
        overtimeType: "NONE",
        subTaskId: "",
        startTime: "",
        endTime: "",
        saving: false,
      });
    } finally {
      setNewEntryState((s) => ({ ...s, saving: false }));
    }
  }

  const overtimeType = (entry?.overtimeType as OvertimeType) ?? "NONE";
  const hasOvertime = overtimeType !== "NONE";

  return (
    <div ref={cellRef} className="relative" data-testid="timesheet-cell">
      {/* ── Inline edit mode ── */}
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          min="0"
          max="24"
          step="0.5"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className={cn(
            "w-full h-9 text-center text-sm font-medium tabular-nums rounded-md border",
            "bg-background border-ring/50 text-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring/30"
          )}
          data-testid="cell-input"
        />
      ) : (
        /* ── Display mode ── */
        <button
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          /* Issue #1539-13: hover tooltip teaches affordance — single-click vs double-click */
          title={
            allLocked
              ? "已核准鎖定，無法編輯"
              : entry && totalHours > 0
                ? "點擊修改時數，雙擊編詳細（分類、備註、加班）"
                : "點擊新增時數，雙擊填寫詳細"
          }
          className={cn(
            "w-full h-9 rounded-md border text-xs transition-all relative",
            "focus:outline-none focus:ring-2 focus:ring-ring/30",
            isWeekend && "bg-muted/20",
            // Item 2: locked visual — gray background
            allLocked && "bg-muted/40 cursor-not-allowed",
            entry && totalHours > 0 && !allLocked
              ? "font-medium border-border/60 hover:border-ring/40"
              : allLocked && totalHours > 0
                ? "font-medium border-border/60"
                : "border-dashed border-border/40 text-muted-foreground/40 hover:border-ring/30 hover:text-muted-foreground hover:bg-accent/20"
          )}
          data-testid="cell-button"
        >
          {entry && totalHours > 0 ? (
            <span className="flex items-center justify-center gap-1">
              {/* Lock icon for locked entries */}
              {allLocked ? (
                <Lock className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
              ) : (
                /* Category color dot */
                <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", getCatDot(entry.category))} />
              )}
              <span className="tabular-nums">{safeFixed(totalHours, 1)}</span>
              {/* Overtime indicator */}
              {hasOvertime && (
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full flex-shrink-0",
                    overtimeType === "WEEKDAY" ? "bg-amber-500" : "bg-red-500"
                  )}
                  title={overtimeType === "WEEKDAY" ? "平日加班" : "假日加班"}
                />
              )}
              {/* Multiple entries indicator */}
              {hasMultiple && (
                <span className="text-[9px] text-muted-foreground/60">+{entries.length - 1}</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground/30">—</span>
          )}
        </button>
      )}

      {/* ── Expanded editor (on double-click) — Item 7: multi-entry individual editing ── */}
      {expanded && (
        <div
          className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 w-72 bg-card border border-border rounded-xl shadow-2xl p-3 space-y-2"
          data-testid="cell-expanded"
        >
          {/* Render ALL entries individually */}
          {entries.map((e, idx) => {
            const state = entryStates.get(e.id);
            if (!state) return null;
            const isLocked = !!e.locked;
            return (
              <div key={e.id} data-testid={`entry-editor-${idx}`}>
                {idx > 0 && <div className="border-t border-border/40 my-2" />}
                {/* Locked badge */}
                {isLocked && (
                  <div className="flex items-center gap-1 text-[10px] text-amber-500/80 mb-1.5">
                    <Lock className="w-3 h-3" />
                    <span>已鎖定</span>
                  </div>
                )}
                <div className="space-y-2">
                  {/* Issue #1008: Start/End time inputs */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">開始時間</label>
                      <input
                        type="time"
                        autoFocus={idx === 0}
                        value={state.startTime}
                        onChange={(ev) => !isLocked && updateEntryField(e.id, "startTime", ev.target.value)}
                        readOnly={isLocked}
                        className={cn(
                          "w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring",
                          isLocked && "opacity-60 cursor-not-allowed"
                        )}
                        data-testid={`entry-start-time-${idx}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">結束時間</label>
                      <input
                        type="time"
                        value={state.endTime}
                        onChange={(ev) => !isLocked && updateEntryField(e.id, "endTime", ev.target.value)}
                        readOnly={isLocked}
                        className={cn(
                          "w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring",
                          isLocked && "opacity-60 cursor-not-allowed"
                        )}
                        data-testid={`entry-end-time-${idx}`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      工時（小時）
                      {state.startTime && state.endTime && calculateHours(state.startTime, state.endTime) !== null && (
                        <span className="ml-1 text-emerald-500">自動計算</span>
                      )}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      step="0.5"
                      value={state.hours}
                      onChange={(ev) => !isLocked && updateEntryField(e.id, "hours", ev.target.value)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" && !isLocked) handleEntrySave(e.id);
                        if (ev.key === "Escape") setExpanded(false);
                      }}
                      readOnly={isLocked || (!!state.startTime && !!state.endTime && calculateHours(state.startTime, state.endTime) !== null)}
                      className={cn(
                        "w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring",
                        isLocked && "opacity-60 cursor-not-allowed",
                        !!state.startTime && !!state.endTime && calculateHours(state.startTime, state.endTime) !== null && !isLocked && "bg-muted/30 text-muted-foreground"
                      )}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">分類</label>
                    <select
                      value={state.category}
                      onChange={(ev) => !isLocked && updateEntryField(e.id, "category", ev.target.value)}
                      disabled={isLocked}
                      className={cn(
                        "w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer",
                        isLocked && "opacity-60 cursor-not-allowed"
                      )}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Issue #933: Subtask selector */}
                  {taskId && subTasks.length > 0 && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">子任務</label>
                      <select
                        value={state.subTaskId}
                        onChange={(ev) => !isLocked && updateEntryField(e.id, "subTaskId", ev.target.value)}
                        disabled={isLocked}
                        className={cn(
                          "w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer",
                          isLocked && "opacity-60 cursor-not-allowed"
                        )}
                      >
                        <option value="">整體（無子任務）</option>
                        {subTasks.map((st) => (
                          <option key={st.id} value={st.id}>{st.title}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">備註</label>
                    <input
                      type="text"
                      value={state.description}
                      onChange={(ev) => !isLocked && updateEntryField(e.id, "description", ev.target.value)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" && !isLocked) handleEntrySave(e.id);
                      }}
                      readOnly={isLocked}
                      className={cn(
                        "w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring",
                        isLocked && "opacity-60 cursor-not-allowed"
                      )}
                      placeholder="可選備註..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">加班類型</label>
                    <select
                      value={state.overtimeType}
                      onChange={(ev) => !isLocked && updateEntryField(e.id, "overtimeType", ev.target.value)}
                      disabled={isLocked}
                      className={cn(
                        "w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer",
                        isLocked && "opacity-60 cursor-not-allowed"
                      )}
                    >
                      {OVERTIME_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Action buttons — hidden for locked entries */}
                  {!isLocked && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        onClick={() => handleEntrySave(e.id)}
                        disabled={state.saving}
                        className="flex-1 bg-accent hover:bg-accent/80 text-accent-foreground text-xs font-medium py-1.5 rounded-md transition-colors disabled:opacity-50"
                        data-testid={`entry-save-${idx}`}
                      >
                        {state.saving ? "儲存中..." : "儲存"}
                      </button>
                      <button
                        onClick={() => handleEntryDelete(e.id)}
                        disabled={state.saving}
                        className="px-2.5 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded-md transition-colors disabled:opacity-50"
                        data-testid={`entry-delete-${idx}`}
                      >
                        刪除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Divider before new entry / actions */}
          {entries.length > 0 && <div className="border-t border-border/40 my-2" />}

          {/* + 新增記錄 button */}
          {!showNewEntry ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNewEntry(true)}
                className="flex-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                data-testid="add-entry-btn"
              >
                + 新增記錄
              </button>
              <button
                onClick={() => setExpanded(false)}
                className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground text-xs rounded-md transition-colors"
              >
                關閉
              </button>
            </div>
          ) : (
            /* New entry inline form */
            <div className="space-y-2" data-testid="new-entry-form">
              <div className="text-xs font-medium text-muted-foreground">新增記錄</div>
              {/* Issue #1008: Start/End time inputs for new entry */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">開始時間</label>
                  <input
                    type="time"
                    autoFocus
                    value={newEntryState.startTime}
                    onChange={(ev) => {
                      const st = ev.target.value;
                      setNewEntryState((s) => {
                        const updated = { ...s, startTime: st };
                        const autoH = calculateHours(st, s.endTime);
                        if (autoH !== null) updated.hours = safeFixed(autoH, 1);
                        return updated;
                      });
                    }}
                    className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    data-testid="new-entry-start-time"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">結束時間</label>
                  <input
                    type="time"
                    value={newEntryState.endTime}
                    onChange={(ev) => {
                      const et = ev.target.value;
                      setNewEntryState((s) => {
                        const updated = { ...s, endTime: et };
                        const autoH = calculateHours(s.startTime, et);
                        if (autoH !== null) updated.hours = safeFixed(autoH, 1);
                        return updated;
                      });
                    }}
                    className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    data-testid="new-entry-end-time"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  工時（小時）
                  {newEntryState.startTime && newEntryState.endTime && calculateHours(newEntryState.startTime, newEntryState.endTime) !== null && (
                    <span className="ml-1 text-emerald-500">自動計算</span>
                  )}
                </label>
                <input
                  type="number"
                  min="0"
                  max="24"
                  step="0.5"
                  value={newEntryState.hours}
                  onChange={(ev) => setNewEntryState((s) => ({ ...s, hours: ev.target.value }))}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") handleNewEntrySave();
                    if (ev.key === "Escape") setShowNewEntry(false);
                  }}
                  readOnly={!!newEntryState.startTime && !!newEntryState.endTime && calculateHours(newEntryState.startTime, newEntryState.endTime) !== null}
                  className={cn(
                    "w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring",
                    !!newEntryState.startTime && !!newEntryState.endTime && calculateHours(newEntryState.startTime, newEntryState.endTime) !== null && "bg-muted/30 text-muted-foreground"
                  )}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">分類</label>
                <select
                  value={newEntryState.category}
                  onChange={(ev) => setNewEntryState((s) => ({ ...s, category: ev.target.value }))}
                  className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              {/* Issue #933: Subtask selector for new entry */}
              {taskId && subTasks.length > 0 && (
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">子任務</label>
                  <select
                    value={newEntryState.subTaskId}
                    onChange={(ev) => setNewEntryState((s) => ({ ...s, subTaskId: ev.target.value }))}
                    className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                  >
                    <option value="">整體（無子任務）</option>
                    {subTasks.map((st) => (
                      <option key={st.id} value={st.id}>{st.title}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">備註</label>
                <input
                  type="text"
                  value={newEntryState.description}
                  onChange={(ev) => setNewEntryState((s) => ({ ...s, description: ev.target.value }))}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") handleNewEntrySave();
                  }}
                  className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="可選備註..."
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">加班類型</label>
                <select
                  value={newEntryState.overtimeType}
                  onChange={(ev) => setNewEntryState((s) => ({ ...s, overtimeType: ev.target.value as OvertimeType }))}
                  className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                >
                  {OVERTIME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  onClick={handleNewEntrySave}
                  disabled={newEntryState.saving}
                  className="flex-1 bg-accent hover:bg-accent/80 text-accent-foreground text-xs font-medium py-1.5 rounded-md transition-colors disabled:opacity-50"
                  data-testid="new-entry-save"
                >
                  {newEntryState.saving ? "儲存中..." : "新增"}
                </button>
                <button
                  onClick={() => setShowNewEntry(false)}
                  className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground text-xs rounded-md transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
