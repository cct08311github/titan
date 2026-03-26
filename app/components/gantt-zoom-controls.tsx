"use client";

import { cn } from "@/lib/utils";

export type GanttViewMode = "Day" | "Week" | "Month" | "Quarter";

interface GanttZoomControlsProps {
  viewMode: GanttViewMode;
  onViewModeChange: (mode: GanttViewMode) => void;
}

const VIEW_MODES: { value: GanttViewMode; label: string; description: string }[] = [
  { value: "Day", label: "週", description: "每格一天" },
  { value: "Week", label: "月", description: "每格一週" },
  { value: "Quarter", label: "季", description: "每格一個月" },
];

/**
 * 甘特圖時間軸縮放控制
 * 週（Day view）/ 月（Week view）/ 季（Quarter view）
 * 選擇的縮放級別記憶在 localStorage
 */
export function GanttZoomControls({ viewMode, onViewModeChange }: GanttZoomControlsProps) {
  return (
    <div className="inline-flex items-center bg-accent border border-border rounded-lg overflow-hidden">
      {VIEW_MODES.map((mode) => (
        <button
          key={mode.value}
          onClick={() => onViewModeChange(mode.value)}
          title={mode.description}
          className={cn(
            "px-3 py-1.5 text-sm font-medium transition-colors",
            viewMode === mode.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
