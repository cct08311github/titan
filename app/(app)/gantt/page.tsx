"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { ChevronLeft, ChevronRight, Diamond, BarChart2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { extractData, extractItems } from "@/lib/api-client";
import { TaskDetailModal } from "@/app/components/task-detail-modal";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";
import { formatLocalDate } from "@/lib/utils/date";

// ─── Types ────────────────────────────────────────────────────────────────────

type User = { id: string; name: string };
type Milestone = {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  plannedEnd: string;
  status: string;
};
type Task = {
  id: string;
  title: string;
  status: string;
  category: string;
  startDate: string | null;
  dueDate: string | null;
  primaryAssignee: User | null;
  backupAssignee: User | null;
  progressPct: number;
};
type MonthlyGoal = {
  id: string;
  month: number;
  title: string;
  tasks: Task[];
};
type AnnualPlan = {
  id: string;
  year: number;
  title: string;
  milestones: Milestone[];
  monthlyGoals: MonthlyGoal[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

const STATUS_BAR: Record<string, string> = {
  BACKLOG: "bg-muted",
  TODO: "bg-blue-500/70",
  IN_PROGRESS: "bg-warning/80",
  REVIEW: "bg-purple-500/80",
  DONE: "bg-emerald-500/80",
};

const STATUS_LABEL: Record<string, string> = {
  BACKLOG: "待辦",
  TODO: "待處理",
  IN_PROGRESS: "進行中",
  REVIEW: "審核中",
  DONE: "已完成",
};

const MILESTONE_STATUS_COLOR: Record<string, string> = {
  PENDING: "text-muted-foreground",
  IN_PROGRESS: "text-yellow-500",
  COMPLETED: "text-emerald-500",
  DELAYED: "text-danger",
  CANCELLED: "text-muted-foreground/50",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dayOfYear(dateStr: string, year: number): number {
  const d = new Date(dateStr);
  const start = new Date(year, 0, 1);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

function daysInYear(year: number): number {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365;
}

function monthStartDay(month: number, year: number): number {
  return dayOfYear(formatLocalDate(new Date(year, month, 1)), year);
}

// ─── Gantt Bar ────────────────────────────────────────────────────────────────

function dayToDate(day: number, year: number): string {
  const d = new Date(year, 0, 1);
  d.setDate(d.getDate() + day);
  return formatLocalDate(d);
}

type GanttBarProps = {
  task: Task;
  year: number;
  totalDays: number;
  onClick: () => void;
  canDrag?: boolean;
  onDateChange?: (taskId: string, startDate: string | null, dueDate: string | null) => void;
};

function GanttBar({ task, year, totalDays, onClick, canDrag, onDateChange }: GanttBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragTooltip, setDragTooltip] = useState<string | null>(null);
  const dragging = useRef<{ type: "move" | "resize-start" | "resize-end"; startX: number; origStartDay: number; origEndDay: number } | null>(null);
  // Track active listeners for cleanup on unmount (#1200)
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    return () => { cleanupRef.current?.(); };
  }, []);

  if (!task.startDate && !task.dueDate) {
    return (
      <div className="h-5 flex items-center">
        <span className="text-xs text-muted-foreground/50 italic">無日期</span>
      </div>
    );
  }

  const startDay = task.startDate
    ? Math.max(0, dayOfYear(task.startDate, year))
    : (task.dueDate ? Math.max(0, dayOfYear(task.dueDate, year) - 7) : 0);
  const endDay = task.dueDate
    ? Math.min(totalDays, dayOfYear(task.dueDate, year))
    : Math.min(totalDays, startDay + 7);

  const leftPct = (startDay / totalDays) * 100;
  const widthPct = Math.max(0.3, ((endDay - startDay) / totalDays) * 100);

  function handlePointerDown(e: React.PointerEvent, type: "move" | "resize-start" | "resize-end") {
    if (!canDrag || task.status === "DONE") return;
    e.preventDefault();
    e.stopPropagation();
    dragging.current = { type, startX: e.clientX, origStartDay: startDay, origEndDay: endDay };
    const el = barRef.current?.parentElement;
    if (!el) return;

    const totalWidth = el.clientWidth;

    function onMove(ev: PointerEvent) {
      if (!dragging.current) return;
      const dx = ev.clientX - dragging.current.startX;
      const daysDelta = Math.round((dx / totalWidth) * totalDays);

      if (dragging.current.type === "resize-end") {
        const newEnd = Math.max(dragging.current.origStartDay + 1, dragging.current.origEndDay + daysDelta);
        setDragTooltip(`截止日：${dayToDate(newEnd, year)}`);
      } else if (dragging.current.type === "resize-start") {
        const newStart = Math.min(dragging.current.origEndDay - 1, Math.max(0, dragging.current.origStartDay + daysDelta));
        setDragTooltip(`開始日：${dayToDate(newStart, year)}`);
      } else {
        const newStart = Math.max(0, dragging.current.origStartDay + daysDelta);
        const newEnd = dragging.current.origEndDay + daysDelta;
        setDragTooltip(`${dayToDate(newStart, year)} → ${dayToDate(newEnd, year)}`);
      }
    }

    function onUp(ev: PointerEvent) {
      if (!dragging.current) return;
      const dx = ev.clientX - dragging.current.startX;
      const daysDelta = Math.round((dx / totalWidth) * totalDays);

      if (daysDelta !== 0 && onDateChange) {
        if (dragging.current.type === "resize-end") {
          const newEnd = Math.max(dragging.current.origStartDay + 1, dragging.current.origEndDay + daysDelta);
          onDateChange(task.id, task.startDate, dayToDate(newEnd, year));
        } else if (dragging.current.type === "resize-start") {
          const newStart = Math.min(dragging.current.origEndDay - 1, Math.max(0, dragging.current.origStartDay + daysDelta));
          onDateChange(task.id, dayToDate(newStart, year), task.dueDate);
        } else {
          const newStart = Math.max(0, dragging.current.origStartDay + daysDelta);
          const newEnd = dragging.current.origEndDay + daysDelta;
          onDateChange(task.id, dayToDate(newStart, year), dayToDate(newEnd, year));
        }
      }
      dragging.current = null;
      setDragTooltip(null);
      cleanupRef.current = null;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    // Store cleanup so unmount can remove listeners (#1200)
    cleanupRef.current = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }

  return (
    <div className="h-5 relative" ref={barRef}>
      <div
        onClick={onClick}
        onPointerDown={(e) => handlePointerDown(e, "move")}
        title={`${task.title} — ${STATUS_LABEL[task.status] ?? task.status}`}
        className={cn(
          "absolute h-5 rounded-sm flex items-center px-1.5 overflow-hidden",
          canDrag && task.status !== "DONE" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
          "transition-opacity hover:opacity-90",
          STATUS_BAR[task.status] ?? "bg-muted"
        )}
        style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: "4px" }}
      >
        {widthPct > 5 && (
          <span className="text-[10px] text-white/80 font-medium truncate leading-none">
            {task.title}
          </span>
        )}
        {task.progressPct > 0 && (
          <div
            className="absolute inset-0 left-0 bg-white/10 rounded-sm"
            style={{ width: `${task.progressPct}%` }}
          />
        )}
        {/* Drag handle: left edge — Issue #844 (G-3) */}
        {canDrag && task.status !== "DONE" && (
          <div
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20"
            onPointerDown={(e) => handlePointerDown(e, "resize-start")}
          />
        )}
        {/* Drag handle: right edge */}
        {canDrag && task.status !== "DONE" && (
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20"
            onPointerDown={(e) => handlePointerDown(e, "resize-end")}
          />
        )}
      </div>
      {/* Drag tooltip */}
      {dragTooltip && (
        <div
          className="absolute -top-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-2 py-0.5 rounded whitespace-nowrap z-20"
        >
          {dragTooltip}
        </div>
      )}
    </div>
  );
}

// ─── Milestone Type Config ────────────────────────────────────────────────────

const MILESTONE_TYPE_COLOR: Record<string, string> = {
  LAUNCH: "text-emerald-500",
  AUDIT: "text-rose-500",
  CUSTOM: "text-amber-500",
};

const MILESTONE_TYPE_LINE: Record<string, string> = {
  LAUNCH: "bg-emerald-500/30",
  AUDIT: "bg-rose-500/30",
  CUSTOM: "bg-amber-500/30",
};

const MILESTONE_TYPE_LABEL: Record<string, string> = {
  LAUNCH: "上線日",
  AUDIT: "稽核日",
  CUSTOM: "自訂",
};

// ─── Milestone Marker ─────────────────────────────────────────────────────────

type MilestoneMarkerProps = {
  milestone: Milestone;
  year: number;
  totalDays: number;
};

function MilestoneMarker({ milestone, year, totalDays }: MilestoneMarkerProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const day = dayOfYear(milestone.plannedEnd, year);
  if (day < 0 || day > totalDays) return null;
  const leftPct = (day / totalDays) * 100;
  const typeColor = MILESTONE_TYPE_COLOR[milestone.type] ?? MILESTONE_TYPE_COLOR.CUSTOM;
  const lineColor = MILESTONE_TYPE_LINE[milestone.type] ?? MILESTONE_TYPE_LINE.CUSTOM;
  const typeLabel = MILESTONE_TYPE_LABEL[milestone.type] ?? "自訂";
  const dateLabel = new Date(milestone.plannedEnd).toLocaleDateString("zh-TW");

  return (
    <div
      className="absolute top-0 bottom-0 flex flex-col items-center"
      style={{ left: `${leftPct}%` }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={cn("w-px h-full", lineColor)} />
      <div
        className={cn("absolute top-0 -translate-x-1/2 flex flex-col items-center gap-0.5", typeColor)}
        style={{ whiteSpace: "nowrap" }}
      >
        <Diamond className="h-3 w-3 fill-current" />
        <span className="text-[9px] font-medium bg-background/80 px-1 rounded">{milestone.title}</span>
      </div>
      {/* Hover tooltip */}
      {showTooltip && (
        <div className="absolute top-8 -translate-x-1/2 z-30 bg-popover border border-border rounded-lg shadow-xl px-3 py-2 min-w-[160px] pointer-events-none">
          <div className="text-xs font-semibold text-foreground">{milestone.title}</div>
          <div className="text-[10px] text-muted-foreground mt-1 space-y-0.5">
            <div>類型：{typeLabel}</div>
            <div>日期：{dateLabel}</div>
            <div>狀態：{MILESTONE_STATUS_COLOR[milestone.status] ? milestone.status : "PENDING"}</div>
            {milestone.description && (
              <div className="mt-1 text-foreground/70">{milestone.description}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Project Gantt Bar (with drag-to-resize) ────────────────────────────────

type ProjectGanttBarProps = {
  project: ProjectRow;
  year: number;
  totalDays: number;
  canDrag: boolean;
  onDateChange?: (projectId: string, plannedStart: string | null, plannedEnd: string | null) => void;
};

function ProjectGanttBar({ project: proj, year, totalDays, canDrag, onDateChange }: ProjectGanttBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragTooltip, setDragTooltip] = useState<string | null>(null);
  const dragging = useRef<{
    type: "move" | "resize-start" | "resize-end";
    startX: number;
    origStartDay: number;
    origEndDay: number;
  } | null>(null);
  // Track active listeners for cleanup on unmount (#1200)
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    return () => { cleanupRef.current?.(); };
  }, []);

  const hasRange = proj.plannedStart || proj.plannedEnd;

  if (!hasRange) {
    return (
      <div className="h-5 flex items-center">
        <span className="text-xs text-muted-foreground/50 italic">無日期</span>
      </div>
    );
  }

  const startDay = proj.plannedStart
    ? Math.max(0, dayOfYear(proj.plannedStart, year))
    : (proj.plannedEnd ? Math.max(0, dayOfYear(proj.plannedEnd, year) - 30) : 0);
  const endDay = proj.plannedEnd
    ? Math.min(totalDays, dayOfYear(proj.plannedEnd, year))
    : Math.min(totalDays, startDay + 30);
  const leftPct = (startDay / totalDays) * 100;
  const widthPct = Math.max(0.5, ((endDay - startDay) / totalDays) * 100);

  const terminalStatuses = ["COMPLETED", "CLOSED", "CANCELLED"];
  const isDraggable = canDrag && !terminalStatuses.includes(proj.status);

  function handlePointerDown(e: React.PointerEvent, type: "move" | "resize-start" | "resize-end") {
    if (!isDraggable) return;
    e.preventDefault();
    e.stopPropagation();
    dragging.current = { type, startX: e.clientX, origStartDay: startDay, origEndDay: endDay };
    const el = barRef.current?.parentElement;
    if (!el) return;
    const totalWidth = el.clientWidth;

    function onMove(ev: PointerEvent) {
      if (!dragging.current) return;
      const dx = ev.clientX - dragging.current.startX;
      const daysDelta = Math.round((dx / totalWidth) * totalDays);
      if (dragging.current.type === "resize-end") {
        const newEnd = Math.min(totalDays, Math.max(dragging.current.origStartDay + 1, dragging.current.origEndDay + daysDelta));
        setDragTooltip(`結束日：${dayToDate(newEnd, year)}`);
      } else if (dragging.current.type === "resize-start") {
        const newStart = Math.min(dragging.current.origEndDay - 1, Math.max(0, dragging.current.origStartDay + daysDelta));
        setDragTooltip(`開始日：${dayToDate(newStart, year)}`);
      } else {
        const newStart = Math.max(0, dragging.current.origStartDay + daysDelta);
        const newEnd = Math.min(totalDays, dragging.current.origEndDay + daysDelta);
        setDragTooltip(`${dayToDate(newStart, year)} → ${dayToDate(newEnd, year)}`);
      }
    }

    function onUp(ev: PointerEvent) {
      if (!dragging.current) return;
      const dx = ev.clientX - dragging.current.startX;
      const daysDelta = Math.round((dx / totalWidth) * totalDays);
      if (daysDelta !== 0 && onDateChange) {
        if (dragging.current.type === "resize-end") {
          const newEnd = Math.min(totalDays, Math.max(dragging.current.origStartDay + 1, dragging.current.origEndDay + daysDelta));
          onDateChange(proj.id, proj.plannedStart, dayToDate(newEnd, year));
        } else if (dragging.current.type === "resize-start") {
          const newStart = Math.min(dragging.current.origEndDay - 1, Math.max(0, dragging.current.origStartDay + daysDelta));
          onDateChange(proj.id, dayToDate(newStart, year), proj.plannedEnd);
        } else {
          const newStart = Math.max(0, dragging.current.origStartDay + daysDelta);
          const newEnd = Math.min(totalDays, dragging.current.origEndDay + daysDelta);
          onDateChange(proj.id, dayToDate(newStart, year), dayToDate(newEnd, year));
        }
      }
      dragging.current = null;
      setDragTooltip(null);
      cleanupRef.current = null;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    // Store cleanup so unmount can remove listeners (#1200)
    cleanupRef.current = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }

  return (
    <div className="h-5 relative" ref={barRef}>
      <div
        onPointerDown={(e) => handlePointerDown(e, "move")}
        title={`${proj.name} — ${PROJECT_STATUS_LABEL[proj.status] ?? proj.status} (${proj.progressPct}%)`}
        className={cn(
          "absolute h-5 rounded-sm flex items-center px-1.5 overflow-hidden",
          isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-default",
          "transition-opacity hover:opacity-90",
          PROJECT_STATUS_BAR[proj.status] ?? "bg-muted"
        )}
        style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: "4px" }}
      >
        {widthPct > 5 && (
          <span className="text-[10px] text-white/80 font-medium truncate leading-none">
            {PROJECT_STATUS_LABEL[proj.status] ?? proj.status}
          </span>
        )}
        {proj.progressPct > 0 && (
          <div
            className="absolute inset-0 left-0 bg-white/10 rounded-sm"
            style={{ width: `${proj.progressPct}%` }}
          />
        )}
        {/* Drag handles */}
        {isDraggable && (
          <div
            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20"
            onPointerDown={(e) => handlePointerDown(e, "resize-start")}
          />
        )}
        {isDraggable && (
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20"
            onPointerDown={(e) => handlePointerDown(e, "resize-end")}
          />
        )}
      </div>
      {dragTooltip && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-2 py-0.5 rounded whitespace-nowrap z-20">
          {dragTooltip}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type GanttView = "goals" | "projects";

type ProjectRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  progressPct: number;
};

const PROJECT_STATUS_BAR: Record<string, string> = {
  PROPOSED: "bg-muted",
  EVALUATING: "bg-blue-400/60",
  APPROVED: "bg-blue-500/70",
  SCHEDULED: "bg-indigo-500/70",
  REQUIREMENTS: "bg-violet-500/70",
  DESIGN: "bg-purple-500/70",
  DEVELOPMENT: "bg-amber-500/80",
  TESTING: "bg-orange-500/80",
  DEPLOYMENT: "bg-rose-500/80",
  WARRANTY: "bg-pink-400/70",
  COMPLETED: "bg-emerald-500/80",
  POST_REVIEW: "bg-teal-500/70",
  CLOSED: "bg-gray-500/60",
  ON_HOLD: "bg-muted",
  CANCELLED: "bg-muted/50",
};

const PROJECT_STATUS_LABEL: Record<string, string> = {
  PROPOSED: "提案",
  EVALUATING: "評估中",
  APPROVED: "已核准",
  SCHEDULED: "已排程",
  REQUIREMENTS: "需求分析",
  DESIGN: "系統設計",
  DEVELOPMENT: "開發中",
  TESTING: "測試中",
  DEPLOYMENT: "部署中",
  WARRANTY: "保固期",
  COMPLETED: "已完成",
  POST_REVIEW: "後評價",
  CLOSED: "已關閉",
  ON_HOLD: "暫停",
  CANCELLED: "已取消",
};

export default function GanttPage() {
  const { data: session } = useSession();
  const isManager = session?.user?.role === "MANAGER";
  const [year, setYear] = useState(new Date().getFullYear());
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [data, setData] = useState<{ annualPlan: AnnualPlan | null; year: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [view, setView] = useState<GanttView>("goals");
  const [projectRows, setProjectRows] = useState<ProjectRow[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({ year: year.toString() });
      if (assigneeFilter) params.set("assignee", assigneeFilter);
      const res = await fetch(`/api/tasks/gantt?${params}`);
      if (!res.ok) throw new Error("甘特圖資料載入失敗");
      const body = await res.json();
      setData(extractData<{ annualPlan: AnnualPlan | null; year: number }>(body));
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [year, assigneeFilter]);

  const handleDateChange = useCallback(async (taskId: string, startDate: string | null, dueDate: string | null) => {
    try {
      // Use dedicated dates endpoint — Issue #844 (G-3)
      const res = await fetch(`/api/tasks/${taskId}/dates`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: startDate ? new Date(startDate).toISOString() : null,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        toast.error(errBody?.message ?? "時程更新失敗");
        fetchData(); // Revert by re-fetching
        return;
      }
      toast.success("時程已更新");
      fetchData();
    } catch {
      fetchData(); // Revert by re-fetching
    }
  }, [fetchData]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch projects for project view
  const fetchProjects = useCallback(async () => {
    setProjectLoading(true);
    try {
      const res = await fetch(`/api/projects?year=${year}&limit=100`);
      if (!res.ok) throw new Error("項目資料載入失敗");
      const body = await res.json();
      const items = body?.data?.items ?? body?.items ?? [];
      setProjectRows(items);
    } catch {
      setProjectRows([]);
    } finally {
      setProjectLoading(false);
    }
  }, [year]);

  // Handle project date change via drag — Issue #1194 (Gantt drag)
  const handleProjectDateChange = useCallback(async (
    projectId: string,
    plannedStart: string | null,
    plannedEnd: string | null
  ) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plannedStart: plannedStart ? new Date(plannedStart).toISOString() : null,
          plannedEnd: plannedEnd ? new Date(plannedEnd).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        toast.error(errBody?.message ?? "日期更新失敗");
        fetchProjects();
        return;
      }
      toast.success("日期已更新");
      fetchProjects();
    } catch {
      fetchProjects();
    }
  }, [fetchProjects]);

  useEffect(() => {
    if (view === "projects") fetchProjects();
  }, [view, fetchProjects]);

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then((body) => setUsers(extractItems<User>(body))).catch(() => { toast.warning("使用者清單載入失敗"); });
  }, []);

  const plan = data?.annualPlan;
  const totalDays = daysInYear(year);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header — stacks vertically on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">甘特圖</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            {plan ? plan.title : `${year} 年度計畫`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-background border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setView("goals")}
              className={cn(
                "px-3 py-1.5 text-sm transition-colors",
                view === "goals" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              )}
            >
              月度目標
            </button>
            <button
              onClick={() => setView("projects")}
              className={cn(
                "px-3 py-1.5 text-sm transition-colors",
                view === "projects" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              )}
            >
              項目
            </button>
          </div>

          {/* Assignee filter (only in goals view) */}
          {view === "goals" && (
          <select
            aria-label="篩選負責人"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer flex-1 sm:flex-none min-w-0"
          >
            <option value="">全部成員</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          )}

          {/* Year picker */}
          <div className="flex items-center gap-1 bg-background border border-border rounded-md">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="p-1.5 hover:bg-accent rounded-l-md transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <span className="px-3 text-sm font-medium text-foreground tabular-nums">{year}</span>
            <button
              onClick={() => setYear((y) => y + 1)}
              className="p-1.5 hover:bg-accent rounded-r-md transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Project View ─────────────────────────────────────────────── */}
      {view === "projects" ? (
        projectLoading ? (
          <div className="flex-1">
            <PageLoading message="載入項目..." />
          </div>
        ) : projectRows.length === 0 ? (
          <div className="flex-1">
            <PageEmpty
              icon={<BarChart2 className="h-10 w-10" />}
              title={`${year} 年度無項目`}
              description="請先在項目管理頁面建立項目"
            />
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <div className="min-w-[900px]">
              {/* Month header */}
              <div className="flex">
                <div className="w-56 flex-shrink-0" />
                <div className="flex-1 relative">
                  <div className="flex border-b border-border">
                    {MONTHS.map((m, i) => {
                      const widthPct = ((new Date(year, i + 1, 0).getDate()) / totalDays) * 100;
                      return (
                        <div
                          key={i}
                          className="text-center text-xs text-muted-foreground py-2 border-r border-border/50 last:border-0"
                          style={{ width: `${widthPct}%` }}
                        >
                          {m}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Project rows */}
              {projectRows.map((proj) => (
                  <div key={proj.id} className="flex border-b border-border/20 hover:bg-accent/20 transition-colors group">
                    <div className="w-56 flex-shrink-0 px-3 py-1.5 flex items-center gap-2">
                      <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", PROJECT_STATUS_BAR[proj.status] ?? "bg-muted")} />
                      <span className="text-xs text-muted-foreground group-hover:text-foreground truncate transition-colors" title={`${proj.code} ${proj.name}`}>
                        <span className="font-mono text-[10px] mr-1">{proj.code}</span>
                        {proj.name}
                      </span>
                    </div>
                    <div className="flex-1 relative py-1.5 px-1">
                      {MONTHS.map((_, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 w-px bg-border/20"
                          style={{ left: `${(monthStartDay(i, year) / totalDays) * 100}%` }}
                        />
                      ))}
                      <ProjectGanttBar
                        project={proj}
                        year={year}
                        totalDays={totalDays}
                        canDrag={isManager}
                        onDateChange={handleProjectDateChange}
                      />
                    </div>
                  </div>
              ))}
            </div>
          </div>
        )
      ) : loading ? (
        <div className="flex-1">
          <PageLoading message="載入甘特圖..." />
        </div>
      ) : fetchError ? (
        <div className="flex-1">
          <PageError message={fetchError} onRetry={fetchData} />
        </div>
      ) : !plan ? (
        <div className="flex-1">
          <PageEmpty
            icon={<BarChart2 className="h-10 w-10" />}
            title={`找不到 ${year} 年度計畫`}
            description="請先在「年度計畫」頁面建立計畫"
          />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="min-w-[900px]">
            {/* Grid layout: left label col + right timeline col */}
            <div className="flex">
              {/* Left: labels */}
              <div className="w-56 flex-shrink-0" />

              {/* Right: month header */}
              <div className="flex-1 relative">
                <div className="flex border-b border-border">
                  {MONTHS.map((m, i) => {
                    const widthPct = ((new Date(year, i + 1, 0).getDate()) / totalDays) * 100;
                    return (
                      <div
                        key={i}
                        className="text-center text-xs text-muted-foreground py-2 border-r border-border/50 last:border-0"
                        style={{ width: `${widthPct}%` }}
                      >
                        {m}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Milestones row */}
            {plan.milestones.length > 0 && (
              <div className="flex border-b border-border/50">
                <div className="w-56 flex-shrink-0 px-3 py-2 flex items-center gap-2">
                  <Diamond className="h-3 w-3 text-amber-500" />
                  <span className="text-xs font-semibold text-amber-400/80">里程碑</span>
                </div>
                <div className="flex-1 relative h-10">
                  {/* Month grid lines */}
                  {MONTHS.map((_, i) => {
                    const leftPct = (monthStartDay(i, year) / totalDays) * 100;
                    return (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 w-px bg-border/50"
                        style={{ left: `${leftPct}%` }}
                      />
                    );
                  })}
                  {plan.milestones.map((ms) => (
                    <MilestoneMarker key={ms.id} milestone={ms} year={year} totalDays={totalDays} />
                  ))}
                </div>
              </div>
            )}

            {/* Monthly goals + tasks */}
            {plan.monthlyGoals.map((goal) => (
              <div key={goal.id}>
                {/* Goal row */}
                <div className="flex border-b border-border/30 bg-muted/20">
                  <div className="w-56 flex-shrink-0 px-3 py-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {goal.month}月　{goal.title}
                    </span>
                  </div>
                  <div className="flex-1 relative h-8">
                    {MONTHS.map((_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 w-px bg-border/30"
                        style={{ left: `${(monthStartDay(i, year) / totalDays) * 100}%` }}
                      />
                    ))}
                    {/* Month span bar */}
                    {(() => {
                      const start = monthStartDay(goal.month - 1, year);
                      const end = monthStartDay(goal.month, year);
                      const w = ((end - start) / totalDays) * 100;
                      const l = (start / totalDays) * 100;
                      return (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-muted"
                          style={{ left: `${l}%`, width: `${w}%` }}
                        />
                      );
                    })()}
                  </div>
                </div>

                {/* Task rows */}
                {goal.tasks.length === 0 ? (
                  <div className="flex border-b border-border/20">
                    <div className="w-56 flex-shrink-0 px-5 py-2">
                      <span className="text-xs text-muted-foreground/50 italic">無任務</span>
                    </div>
                    <div className="flex-1 h-8" />
                  </div>
                ) : (
                  goal.tasks.map((task) => (
                    <div key={task.id} className="flex border-b border-border/20 hover:bg-accent/20 transition-colors group">
                      <div className="w-56 flex-shrink-0 px-5 py-1.5 flex items-center gap-2">
                        <div
                          className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", STATUS_BAR[task.status] ?? "bg-muted")}
                        />
                        <span
                          className="text-xs text-muted-foreground group-hover:text-foreground cursor-pointer truncate transition-colors"
                          onClick={() => setSelectedTaskId(task.id)}
                          title={task.title}
                        >
                          {task.title}
                        </span>
                        {task.primaryAssignee && (
                          <span className="ml-auto text-[10px] text-muted-foreground/60 flex-shrink-0">
                            {task.primaryAssignee.name.slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 relative py-1.5 px-1">
                        {MONTHS.map((_, i) => (
                          <div
                            key={i}
                            className="absolute top-0 bottom-0 w-px bg-border/20"
                            style={{ left: `${(monthStartDay(i, year) / totalDays) * 100}%` }}
                          />
                        ))}
                        <GanttBar
                          task={task}
                          year={year}
                          totalDays={totalDays}
                          onClick={() => setSelectedTaskId(task.id)}
                          canDrag={isManager}
                          onDateChange={handleDateChange}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task detail modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdated={() => { setSelectedTaskId(null); fetchData(); }}
        />
      )}
    </div>
  );
}
