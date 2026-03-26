"use client";

/**
 * WorkspaceTableView — Issue #961
 *
 * Table/list view for the unified workspace.
 * Displays tasks in a sortable table with columns:
 * title, status, priority, assignee, due date, progress.
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { type TaskCardData } from "@/app/components/task-card";

// ─── Types ──────────────────────────────────────────────────────────────────

type SortKey = "title" | "status" | "priority" | "dueDate" | "progressPct";
type SortDir = "asc" | "desc";

interface WorkspaceTableViewProps {
  tasks: TaskCardData[];
  onTaskClick: (id: string) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  BACKLOG: "待辦清單",
  TODO: "待處理",
  IN_PROGRESS: "進行中",
  REVIEW: "審核中",
  DONE: "已完成",
};

const STATUS_COLOR: Record<string, string> = {
  BACKLOG: "text-muted-foreground",
  TODO: "text-blue-500",
  IN_PROGRESS: "text-yellow-500",
  REVIEW: "text-purple-500",
  DONE: "text-emerald-500",
};

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "title", label: "任務名稱", className: "text-left" },
  { key: "status", label: "狀態" },
  { key: "priority", label: "優先度" },
  { key: "dueDate", label: "到期日" },
  { key: "progressPct", label: "進度" },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function WorkspaceTableView({ tasks, onTaskClick }: WorkspaceTableViewProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleHeaderClick(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return tasks;
    const dir = sortDir === "asc" ? 1 : -1;

    return [...tasks].sort((a, b) => {
      switch (sortKey) {
        case "title":
          return dir * a.title.localeCompare(b.title);
        case "status":
          return dir * a.status.localeCompare(b.status);
        case "priority":
          return dir * ((PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));
        case "dueDate": {
          const da = a.dueDate ?? "";
          const db = b.dueDate ?? "";
          return dir * da.localeCompare(db);
        }
        case "progressPct": {
          const pa = (a as TaskCardData & { progressPct?: number }).progressPct ?? 0;
          const pb = (b as TaskCardData & { progressPct?: number }).progressPct ?? 0;
          return dir * (pa - pb);
        }
        default:
          return 0;
      }
    });
  }, [tasks, sortKey, sortDir]);

  if (tasks.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-12">
        無符合條件的任務
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl overflow-auto bg-card">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleHeaderClick(col.key)}
                className={cn(
                  "px-3 py-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none",
                  col.className
                )}
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
                )}
              </th>
            ))}
            <th className="px-3 py-2 font-medium text-muted-foreground">負責人</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((task) => {
            const t = task as TaskCardData & { progressPct?: number };
            return (
              <tr
                key={task.id}
                role="row"
                onClick={() => onTaskClick(task.id)}
                className="border-b border-border/50 hover:bg-accent/30 transition-colors cursor-pointer"
              >
                <td className="px-3 py-2 font-medium">{task.title}</td>
                <td className={cn("px-3 py-2", STATUS_COLOR[task.status])}>
                  {STATUS_LABEL[task.status] ?? task.status}
                </td>
                <td className="px-3 py-2">{task.priority}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString("zh-TW") : "—"}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {t.progressPct != null ? `${t.progressPct}%` : "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {task.primaryAssignee?.name ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
