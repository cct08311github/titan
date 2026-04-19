"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Grid3X3, List, Calendar, CalendarDays, Copy, FileDown, RefreshCw, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { TemplateSelector } from "./template-selector";
import { OvertimeBadge } from "./overtime-badge";
import { type TimeEntry } from "./use-timesheet";

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "grid" | "list" | "calendar" | "calendar-week" | "calendar-month";

type TimesheetToolbarProps = {
  weekRange: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onThisWeek: () => void;
  onCopyPreviousWeek: () => Promise<{ ok: boolean; count: number }>;
  onRefresh: () => void;
  loading?: boolean;
  // Template props (Item 6)
  weekStart?: Date;
  entries?: TimeEntry[];
  daysCount?: number;
  getDateStr?: (offset: number) => string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function TimesheetToolbar({
  weekRange,
  viewMode,
  onViewModeChange,
  onPrevWeek,
  onNextWeek,
  onThisWeek,
  onCopyPreviousWeek,
  onRefresh,
  loading,
  weekStart,
  entries,
  daysCount,
  getDateStr,
}: TimesheetToolbarProps) {
  const [copying, setCopying] = useState(false);
  const [copyResult, setCopyResult] = useState<"success" | "error" | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  async function handleCopy() {
    setCopying(true);
    setCopyResult(null);
    setCopyToast(null);
    try {
      const result = await onCopyPreviousWeek();
      setCopyResult(result.ok ? "success" : "error");
      if (result.ok && result.count > 0) {
        setCopyToast(`已複製上週 ${result.count} 筆工時`);
      } else if (result.ok) {
        setCopyToast("已複製上週工時");
      }
      setTimeout(() => {
        setCopyResult(null);
        setCopyToast(null);
      }, 3000);
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Row 1: Title + week range + navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">工時紀錄</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">{weekRange}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-background border border-border rounded-md overflow-hidden">
            <button
              onClick={() => onViewModeChange("grid")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors",
                viewMode === "grid"
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
              data-testid="view-grid-btn"
            >
              <Grid3X3 className="h-3.5 w-3.5" />
              格子
            </button>
            <button
              onClick={() => onViewModeChange("list")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors",
                viewMode === "list"
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
              data-testid="view-list-btn"
            >
              <List className="h-3.5 w-3.5" />
              列表
            </button>
            <button
              onClick={() => onViewModeChange("calendar")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors",
                viewMode === "calendar"
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
              data-testid="view-calendar-btn"
            >
              <Calendar className="h-3.5 w-3.5" />
              日曆(日)
            </button>
            <button
              onClick={() => onViewModeChange("calendar-week")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors",
                viewMode === "calendar-week"
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
              data-testid="view-calendar-week-btn"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              日曆(週)
            </button>
            {/* Issue #966: Month calendar view */}
            <button
              onClick={() => onViewModeChange("calendar-month")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors",
                viewMode === "calendar-month"
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
              data-testid="view-calendar-month-btn"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              日曆(月)
            </button>
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-0.5 bg-background border border-border rounded-md">
            <button
              onClick={onPrevWeek}
              className="p-1.5 hover:bg-accent rounded-l-md transition-colors"
              data-testid="prev-week-btn"
              aria-label="上一週"
            >
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={onThisWeek}
              className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="this-week-btn"
            >
              本週
            </button>
            <button
              onClick={onNextWeek}
              className="p-1.5 hover:bg-accent rounded-r-md transition-colors"
              data-testid="next-week-btn"
              aria-label="下一週"
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 rounded-md bg-background border border-border hover:bg-accent transition-colors"
            data-testid="refresh-btn"
            aria-label="重新整理"
          >
            <RefreshCw className={cn("h-4 w-4 text-muted-foreground", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Row 2: Quick actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleCopy}
          disabled={copying}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors",
            copyResult === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
              : copyResult === "error"
                ? "border-red-500/30 bg-red-500/10 text-red-400"
                : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent/50",
            copying && "opacity-50"
          )}
          data-testid="copy-week-btn"
        >
          <Copy className="h-3.5 w-3.5" />
          {copyResult === "success" ? "已複製" : copyResult === "error" ? "複製失敗" : "複製上週"}
        </button>

        {/* Template selector (Item 6) */}
        {weekStart && entries && daysCount && getDateStr && (
          <TemplateSelector
            weekStart={weekStart}
            entries={entries}
            daysCount={daysCount}
            getDateStr={getDateStr}
            onRefresh={onRefresh}
          />
        )}

        {/* Overtime badge (Item 9) */}
        {weekStart && <OvertimeBadge weekStart={weekStart} />}

        {/* Color legend */}
        <div className="flex items-center gap-3 ml-auto text-[10px] text-muted-foreground/50">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> 正常
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> 超時/平日OT
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> 假日OT
          </span>
        </div>
      </div>

      {/* Copy toast (Issue #1023) */}
      {copyToast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 animate-in fade-in slide-in-from-bottom-2 duration-200"
          role="status"
          data-testid="copy-week-toast"
        >
          <Check className="h-4 w-4" />
          {copyToast}
        </div>
      )}
    </div>
  );
}

export type { ViewMode };
