"use client";

import { useRef, useEffect, useCallback } from "react";

// frappe-gantt types (library ships UMD/ES)
interface FrappeTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  custom_class?: string;
  dependencies?: string;
}

interface GanttOptions {
  header_height?: number;
  column_width?: number;
  step?: number;
  view_modes?: string[];
  bar_height?: number;
  bar_corner_radius?: number;
  arrow_curve?: number;
  padding?: number;
  view_mode?: string;
  date_format?: string;
  language?: string;
  on_click?: (task: FrappeTask) => void;
  on_date_change?: (task: FrappeTask, start: Date, end: Date) => void;
  on_progress_change?: (task: FrappeTask, progress: number) => void;
  on_view_change?: (mode: string) => void;
  custom_popup_html?: (task: FrappeTask) => string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GanttInstance = any;

interface TaskItem {
  id: string;
  title: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  progressPct: number;
  primaryAssignee?: { name: string } | null;
}

interface GanttChartProps {
  tasks: TaskItem[];
  viewMode?: "Day" | "Week" | "Month" | "Quarter";
  onTaskClick?: (taskId: string) => void;
  onDateChange?: (taskId: string, startDate: string, endDate: string) => void;
}

const STATUS_CLASS: Record<string, string> = {
  BACKLOG: "gantt-bar--backlog",
  TODO: "gantt-bar--todo",
  IN_PROGRESS: "gantt-bar--in-progress",
  REVIEW: "gantt-bar--review",
  DONE: "gantt-bar--done",
};

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * frappe-gantt wrapper component
 * Renders tasks with startDate + dueDate on a Gantt timeline
 */
export function GanttChart({ tasks, viewMode = "Month", onTaskClick, onDateChange }: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<GanttInstance>(null);

  // Convert tasks to frappe-gantt format (only tasks with both dates)
  const frappeTasks: FrappeTask[] = tasks
    .filter((t) => t.startDate && t.dueDate)
    .map((t) => ({
      id: t.id,
      name: t.title,
      start: t.startDate!,
      end: t.dueDate!,
      progress: t.status === "DONE" ? 100 : t.progressPct,
      custom_class: STATUS_CLASS[t.status] || "",
    }));

  const initGantt = useCallback(async () => {
    if (!containerRef.current || frappeTasks.length === 0) return;

    // Dynamic import since frappe-gantt doesn't support SSR
    const { default: Gantt } = await import("frappe-gantt");

    // Clear previous content safely
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild);
    }

    const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    containerRef.current.appendChild(svgEl);

    ganttRef.current = new Gantt(svgEl, frappeTasks, {
      view_mode: viewMode,
      date_format: "YYYY-MM-DD",
      language: "zh",
      bar_height: 24,
      bar_corner_radius: 4,
      padding: 14,
      on_click: (task: FrappeTask) => {
        onTaskClick?.(task.id);
      },
      on_date_change: (task: FrappeTask, start: Date, end: Date) => {
        onDateChange?.(task.id, formatDate(start), formatDate(end));
      },
      custom_popup_html: (task: FrappeTask) => {
        const t = tasks.find((tt) => tt.id === task.id);
        const assignee = escapeHtml(t?.primaryAssignee?.name || "未指派");
        const name = escapeHtml(task.name);
        return `<div class="details-container"><h5>${name}</h5><p>負責人: ${assignee}</p><p>進度: ${task.progress}%</p></div>`;
      },
    } as GanttOptions);
  }, [frappeTasks.length, viewMode]);

  useEffect(() => {
    initGantt();
  }, [initGantt]);

  // Update view mode
  useEffect(() => {
    if (ganttRef.current && typeof ganttRef.current.change_view_mode === "function") {
      ganttRef.current.change_view_mode(viewMode);
    }
  }, [viewMode]);

  if (frappeTasks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">沒有可顯示的任務（需有開始日和截止日）</p>
      </div>
    );
  }

  return (
    <div className="gantt-wrapper overflow-x-auto">
      <style>{`
        .gantt-wrapper .gantt-container { font-family: inherit; }
        .gantt-wrapper .bar-wrapper .bar { fill: #6b7280; }
        .gantt-wrapper .gantt-bar--backlog .bar { fill: #6b7280; }
        .gantt-wrapper .gantt-bar--todo .bar { fill: #3b82f6; }
        .gantt-wrapper .gantt-bar--in-progress .bar { fill: #eab308; }
        .gantt-wrapper .gantt-bar--review .bar { fill: #a855f7; }
        .gantt-wrapper .gantt-bar--done .bar { fill: #22c55e; }
        .gantt-wrapper .bar-progress { fill: rgba(255,255,255,0.2); }
        .gantt-wrapper .details-container { padding: 8px 12px; }
        .gantt-wrapper .details-container h5 { margin: 0 0 4px; font-size: 13px; }
        .gantt-wrapper .details-container p { margin: 2px 0; font-size: 11px; color: #666; }
      `}</style>
      <div ref={containerRef} />
    </div>
  );
}
