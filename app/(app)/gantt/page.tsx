"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { ChevronLeft, ChevronRight, Diamond, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskDetailModal } from "@/app/components/task-detail-modal";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";

// ─── Types ────────────────────────────────────────────────────────────────────

type User = { id: string; name: string };
type Milestone = {
  id: string;
  title: string;
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
  return dayOfYear(new Date(year, month, 1).toISOString().split("T")[0], year);
}

// ─── Gantt Bar ────────────────────────────────────────────────────────────────

function dayToDate(day: number, year: number): string {
  const d = new Date(year, 0, 1);
  d.setDate(d.getDate() + day);
  return d.toISOString().split("T")[0];
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
  const dragging = useRef<{ type: "move" | "resize-end"; startX: number; origStartDay: number; origEndDay: number } | null>(null);

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

  function handlePointerDown(e: React.PointerEvent, type: "move" | "resize-end") {
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
        setDragTooltip(dayToDate(newEnd, year));
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
        } else {
          const newStart = Math.max(0, dragging.current.origStartDay + daysDelta);
          const newEnd = dragging.current.origEndDay + daysDelta;
          onDateChange(task.id, dayToDate(newStart, year), dayToDate(newEnd, year));
        }
      }
      dragging.current = null;
      setDragTooltip(null);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
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

// ─── Milestone Marker ─────────────────────────────────────────────────────────

type MilestoneMarkerProps = {
  milestone: Milestone;
  year: number;
  totalDays: number;
};

function MilestoneMarker({ milestone, year, totalDays }: MilestoneMarkerProps) {
  const day = dayOfYear(milestone.plannedEnd, year);
  if (day < 0 || day > totalDays) return null;
  const leftPct = (day / totalDays) * 100;

  return (
    <div
      className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none"
      style={{ left: `${leftPct}%` }}
    >
      <div className="w-px h-full bg-amber-500/30" />
      <div
        className={cn("absolute top-0 -translate-x-1/2 flex flex-col items-center gap-0.5", MILESTONE_STATUS_COLOR[milestone.status] ?? "text-muted-foreground")}
        style={{ whiteSpace: "nowrap" }}
      >
        <Diamond className="h-3 w-3 fill-current" />
        <span className="text-[9px] font-medium bg-background/80 px-1 rounded">{milestone.title}</span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

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

  const handleDateChange = useCallback(async (taskId: string, startDate: string | null, dueDate: string | null) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, dueDate }),
      });
      if (!res.ok) throw new Error("更新失敗");
      // Record the change
      await fetch(`/api/tasks/${taskId}/changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "DELAY", note: `甘特圖拖曳調整：截止日 → ${dueDate}` }),
      });
      fetchData();
    } catch {
      fetchData(); // Revert by re-fetching
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({ year: year.toString() });
      if (assigneeFilter) params.set("assignee", assigneeFilter);
      const res = await fetch(`/api/tasks/gantt?${params}`);
      if (!res.ok) throw new Error("甘特圖資料載入失敗");
      setData(await res.json());
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [year, assigneeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then((d) => setUsers(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const plan = data?.annualPlan;
  const totalDays = daysInYear(year);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">甘特圖</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {plan ? plan.title : `${year} 年度計畫`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Assignee filter */}
          <select
            aria-label="篩選負責人"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          >
            <option value="">全部成員</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>

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

      {loading ? (
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
