"use client";

/**
 * WorkspaceFilterBar — Issue #961
 *
 * Filter controls for the unified workspace page.
 * Reads/writes filters via WorkspaceContext.
 */

import { useWorkspace } from "@/app/components/workspace/workspace-context";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "", label: "全部狀態" },
  { value: "BACKLOG", label: "待辦清單" },
  { value: "TODO", label: "待處理" },
  { value: "IN_PROGRESS", label: "進行中" },
  { value: "REVIEW", label: "審核中" },
  { value: "DONE", label: "已完成" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "全部優先度" },
  { value: "P0", label: "P0 — 緊急" },
  { value: "P1", label: "P1 — 高" },
  { value: "P2", label: "P2 — 中" },
  { value: "P3", label: "P3 — 低" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "全部分類" },
  { value: "PLANNED", label: "計畫內" },
  { value: "ADDED", label: "新增" },
  { value: "INCIDENT", label: "事件" },
  { value: "SUPPORT", label: "支援" },
  { value: "ADMIN", label: "行政" },
  { value: "LEARNING", label: "學習" },
];

const selectClass =
  "bg-background border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer";

export function WorkspaceFilterBar({ className }: { className?: string }) {
  const { filters, setFilters } = useWorkspace();

  function update(key: keyof typeof filters, value: string) {
    setFilters({ ...filters, [key]: value });
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <input
        type="text"
        aria-label="篩選負責人"
        placeholder="負責人 ID..."
        value={filters.assignee}
        onChange={(e) => update("assignee", e.target.value)}
        className={cn(selectClass, "w-36")}
      />

      <select
        aria-label="篩選狀態"
        value={filters.status}
        onChange={(e) => update("status", e.target.value)}
        className={selectClass}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        aria-label="篩選優先度"
        value={filters.priority}
        onChange={(e) => update("priority", e.target.value)}
        className={selectClass}
      >
        {PRIORITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        aria-label="篩選分類"
        value={filters.category}
        onChange={(e) => update("category", e.target.value)}
        className={selectClass}
      >
        {CATEGORY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
