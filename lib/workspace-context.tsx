"use client";

/**
 * Workspace Context — Issue #961
 *
 * Provides shared state for the unified workspace page:
 * - Task data (fetched from /api/tasks)
 * - View mode (kanban | gantt | list) synced to URL
 * - Filters (assignee, status, priority, category) synced to URL
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { extractItems } from "@/lib/api-client";
import { type TaskCardData } from "@/app/components/task-card";

// ─── Types ──────────────────────────────────────────────────────────────────

export type WorkspaceViewMode = "kanban" | "gantt" | "list";

export interface WorkspaceFilters {
  assignee: string;
  status: string;
  priority: string;
  category: string;
}

export interface WorkspaceContextValue {
  tasks: TaskCardData[];
  loading: boolean;
  fetchError: string | null;
  viewMode: WorkspaceViewMode;
  setViewMode: (mode: WorkspaceViewMode) => void;
  filters: WorkspaceFilters;
  setFilters: (filters: WorkspaceFilters) => void;
  hasActiveFilters: boolean;
  refresh: () => void;
}

export const emptyWorkspaceFilters: WorkspaceFilters = {
  assignee: "",
  status: "",
  priority: "",
  category: "",
};

const VALID_VIEWS: WorkspaceViewMode[] = ["kanban", "gantt", "list"];

// ─── Context ────────────────────────────────────────────────────────────────

const WorkspaceCtx = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) {
    throw new Error("useWorkspace must be used within <WorkspaceProvider>");
  }
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read initial state from URL
  const initialView = (() => {
    const v = searchParams.get("view") as WorkspaceViewMode;
    return VALID_VIEWS.includes(v) ? v : "kanban";
  })();

  const initialFilters: WorkspaceFilters = {
    assignee: searchParams.get("assignee") ?? "",
    status: searchParams.get("status") ?? "",
    priority: searchParams.get("priority") ?? "",
    category: searchParams.get("category") ?? "",
  };

  const [viewMode, setViewModeState] = useState<WorkspaceViewMode>(initialView);
  const [filters, setFiltersState] = useState<WorkspaceFilters>(initialFilters);
  const [tasks, setTasks] = useState<TaskCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const hasActiveFilters =
    filters.assignee !== "" ||
    filters.status !== "" ||
    filters.priority !== "" ||
    filters.category !== "";

  // Sync state to URL
  const syncUrl = useCallback(
    (mode: WorkspaceViewMode, f: WorkspaceFilters) => {
      const params = new URLSearchParams();
      if (mode !== "kanban") params.set("view", mode);
      if (f.assignee) params.set("assignee", f.assignee);
      if (f.status) params.set("status", f.status);
      if (f.priority) params.set("priority", f.priority);
      if (f.category) params.set("category", f.category);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname]
  );

  const setViewMode = useCallback(
    (mode: WorkspaceViewMode) => {
      setViewModeState(mode);
      syncUrl(mode, filters);
    },
    [filters, syncUrl]
  );

  const setFilters = useCallback(
    (f: WorkspaceFilters) => {
      setFiltersState(f);
      syncUrl(viewMode, f);
    },
    [viewMode, syncUrl]
  );

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Fetch tasks
  useEffect(() => {
    let cancelled = false;

    async function fetchTasks() {
      setLoading(true);
      setFetchError(null);
      try {
        const params = new URLSearchParams();
        if (filters.assignee) params.set("assignee", filters.assignee);
        if (filters.status) params.set("status", filters.status);
        if (filters.priority) params.set("priority", filters.priority);
        if (filters.category) params.set("category", filters.category);

        const res = await fetch(`/api/tasks?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        const items = extractItems<TaskCardData>(body);
        if (!cancelled) setTasks(items);
      } catch (err) {
        if (!cancelled) setFetchError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTasks();
    return () => {
      cancelled = true;
    };
  }, [filters, refreshKey]);

  return (
    <WorkspaceCtx.Provider
      value={{
        tasks,
        loading,
        fetchError,
        viewMode,
        setViewMode,
        filters,
        setFilters,
        hasActiveFilters,
        refresh,
      }}
    >
      {children}
    </WorkspaceCtx.Provider>
  );
}
