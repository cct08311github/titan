"use client";

import { useState, useEffect, useCallback } from "react";
import type { GanttViewMode } from "@/app/components/gantt-zoom-controls";

const STORAGE_KEY = "titan-gantt-zoom";
const DEFAULT_MODE: GanttViewMode = "Week";

/**
 * Hook for managing gantt zoom level with localStorage persistence.
 * Default: "Week" (month view - 每格一週)
 */
export function useGanttZoom() {
  const [viewMode, setViewMode] = useState<GanttViewMode>(DEFAULT_MODE);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && ["Day", "Week", "Month", "Quarter"].includes(stored)) {
        setViewMode(stored as GanttViewMode);
      }
    } catch {
      // localStorage unavailable (SSR or privacy mode)
    }
  }, []);

  const changeViewMode = useCallback((mode: GanttViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage unavailable
    }
  }, []);

  return { viewMode, changeViewMode };
}
