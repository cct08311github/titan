"use client";

/**
 * KanbanFilters — filter bar for the Kanban page extracted from kanban/page.tsx
 * Renders TaskFilters + project dropdown.
 */

import { X } from "lucide-react";
import {
  TaskFilters,
  type TaskFilters as FiltersType,
} from "@/app/components/task-filters";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface KanbanFiltersProps {
  filters: FiltersType;
  allTaskCount: number;
  filteredTaskCount: number;
  projectFilter: string;
  projectOptions: { id: string; code: string; name: string }[];
  onFiltersChange: (filters: FiltersType) => void;
  onProjectFilterChange: (projectId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function KanbanFilters({
  filters,
  allTaskCount,
  filteredTaskCount,
  projectFilter,
  projectOptions,
  onFiltersChange,
  onProjectFilterChange,
}: KanbanFiltersProps) {
  return (
    <div className="flex-shrink-0 space-y-2">
      <TaskFilters
        filters={filters}
        onChange={onFiltersChange}
        totalCount={allTaskCount}
        filteredCount={filteredTaskCount}
        syncUrl
      />
      {/* Project filter — Issue #1176 */}
      {projectOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            aria-label="篩選項目"
            value={projectFilter}
            onChange={(e) => onProjectFilterChange(e.target.value)}
            className="h-9 bg-card border border-border text-foreground text-sm rounded-lg px-3 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 cursor-pointer hover:border-muted-foreground/30 transition-all shadow-sm"
          >
            <option value="">所有項目</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} {p.name}
              </option>
            ))}
          </select>
          {projectFilter && (
            <button
              onClick={() => onProjectFilterChange("")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
