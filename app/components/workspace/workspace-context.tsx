"use client";

/**
 * Unified Workspace Context — Issue #961
 *
 * Component-level wrapper that provides:
 * 1. WorkspaceProvider (shared task data, filters, view mode)
 * 2. ViewSwitcher component (看板 | 甘特 | 列表 tabs)
 * 3. Shared filter state persisted to URL params
 *
 * All views (Kanban, Gantt, Table) consume from the same context,
 * ensuring data consistency and avoiding redundant API calls.
 */

import { Suspense } from "react";
import { KanbanSquare, GanttChartSquare, List } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WorkspaceProvider,
  useWorkspace,
  type WorkspaceViewMode,
  type WorkspaceFilters,
  type WorkspaceContextValue,
  emptyWorkspaceFilters,
} from "@/lib/workspace-context";
import { PageLoading } from "@/app/components/page-states";

// ─── Re-exports ──────────────────────────────────────────────────────────────

export {
  WorkspaceProvider,
  useWorkspace,
  emptyWorkspaceFilters,
};
export type {
  WorkspaceViewMode,
  WorkspaceFilters,
  WorkspaceContextValue,
};

// ─── View Tab Config ─────────────────────────────────────────────────────────

export const VIEW_TABS: {
  mode: WorkspaceViewMode;
  label: string;
  icon: typeof KanbanSquare;
}[] = [
  { mode: "kanban", label: "看板", icon: KanbanSquare },
  { mode: "gantt", label: "甘特", icon: GanttChartSquare },
  { mode: "list", label: "列表", icon: List },
];

// ─── ViewSwitcher Component ──────────────────────────────────────────────────

export interface ViewSwitcherProps {
  /** Currently active view mode */
  viewMode: WorkspaceViewMode;
  /** Callback when user selects a different view */
  onViewModeChange: (mode: WorkspaceViewMode) => void;
  /** Optional extra CSS class */
  className?: string;
}

/**
 * Tab-style view switcher: 看板 | 甘特 | 列表
 *
 * Designed for the workspace toolbar — renders inline tab buttons
 * that switch the active view while preserving all filter state.
 */
export function ViewSwitcher({
  viewMode,
  onViewModeChange,
  className,
}: ViewSwitcherProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center bg-muted/50 rounded-lg p-0.5 gap-0.5",
        className
      )}
      role="tablist"
      aria-label="檢視模式"
    >
      {VIEW_TABS.map(({ mode, label, icon: Icon }) => (
        <button
          key={mode}
          role="tab"
          aria-selected={viewMode === mode}
          aria-label={`切換到${label}檢視`}
          onClick={() => onViewModeChange(mode)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
            viewMode === mode
              ? "bg-background text-foreground font-medium shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * Connected ViewSwitcher — reads/writes from WorkspaceContext automatically.
 * Use this when rendering inside a WorkspaceProvider.
 */
export function ConnectedViewSwitcher({ className }: { className?: string }) {
  const { viewMode, setViewMode } = useWorkspace();
  return (
    <ViewSwitcher
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      className={className}
    />
  );
}

// ─── WorkspaceShell — convenience wrapper ────────────────────────────────────

export interface WorkspaceShellProps {
  children: React.ReactNode;
}

/**
 * Top-level shell that wraps content with WorkspaceProvider + Suspense.
 * Use this in page.tsx to bootstrap the unified workspace:
 *
 * ```tsx
 * export default function WorkPage() {
 *   return (
 *     <WorkspaceShell>
 *       <WorkspaceContent />
 *     </WorkspaceShell>
 *   );
 * }
 * ```
 */
export function WorkspaceShell({ children }: WorkspaceShellProps) {
  return (
    <Suspense fallback={<PageLoading message="載入工作空間..." />}>
      <WorkspaceProvider>{children}</WorkspaceProvider>
    </Suspense>
  );
}
