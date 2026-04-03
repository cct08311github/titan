"use client";

/**
 * StakeholderMatrix — 2x2 influence x interest matrix visualization
 * Issue #1194 — PMO Visualizations
 */

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Stakeholder {
  id: string;
  name: string;
  influence: string | null;
  interest: string | null;
  engagement: string | null;
}

interface Props {
  stakeholders: Stakeholder[];
}

// Map influence/interest to a 0-1 value for positioning
function axisValue(level: string | null): number {
  switch (level) {
    case "HIGH":
      return 0.8;
    case "MEDIUM":
      return 0.5;
    case "LOW":
      return 0.2;
    default:
      return 0.5; // unknown → center
  }
}

// engagement → dot color
const ENGAGEMENT_COLOR: Record<string, string> = {
  CHAMPION: "bg-emerald-500",
  SUPPORTER: "bg-blue-500",
  NEUTRAL: "bg-gray-400",
  RESISTANT: "bg-red-500",
};

const ENGAGEMENT_LABEL: Record<string, string> = {
  CHAMPION: "倡導者",
  SUPPORTER: "支持者",
  NEUTRAL: "中立",
  RESISTANT: "抵觸",
};

export function StakeholderMatrix({ stakeholders }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (stakeholders.length === 0) return (
    <div className="text-center text-muted-foreground py-8 text-sm">尚未設定利害關係人</div>
  );

  // Quadrant labels
  const quadrants = [
    { row: 0, col: 0, label: "密切管理", sublabel: "Manage closely", bg: "bg-red-50 dark:bg-red-950/20" },
    { row: 0, col: 1, label: "持續溝通", sublabel: "Keep informed", bg: "bg-yellow-50 dark:bg-yellow-950/20" },
    { row: 1, col: 0, label: "持續監控", sublabel: "Monitor", bg: "bg-blue-50 dark:bg-blue-950/20" },
    { row: 1, col: 1, label: "最低關注", sublabel: "Minimal effort", bg: "bg-green-50 dark:bg-green-950/20" },
  ];

  return (
    <div className="mb-4">
      <p className="text-xs font-medium text-muted-foreground mb-2">利害關係人矩陣</p>
      <div className="flex">
        {/* Y-axis label */}
        <div className="flex flex-col items-center justify-center mr-1 w-4">
          <span className="text-[9px] text-muted-foreground writing-vertical" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
            影響力
          </span>
        </div>
        <div className="flex-1">
          {/* Y-axis ticks */}
          <div className="flex items-center mb-0.5">
            <div className="w-6 text-right">
              <span className="text-[9px] text-muted-foreground">高</span>
            </div>
            <div className="flex-1" />
          </div>
          {/* 2x2 grid */}
          <div className="grid grid-cols-2 grid-rows-2 border border-border rounded-lg overflow-hidden" style={{ height: 200 }}>
            {quadrants.map((q, i) => (
              <div
                key={i}
                className={cn("relative border-border", q.bg, {
                  "border-r": q.col === 0,
                  "border-b": q.row === 0,
                })}
              >
                {/* Quadrant label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-40">
                  <span className="text-[10px] font-medium">{q.label}</span>
                  <span className="text-[8px]">{q.sublabel}</span>
                </div>
                {/* Dots for stakeholders in this quadrant */}
                {stakeholders
                  .filter((s) => {
                    const inf = axisValue(s.influence);
                    const int = axisValue(s.interest);
                    const highInf = inf > 0.5;
                    const highInt = int > 0.5;
                    // Spec layout: y=influence (top=high), x=interest (left=high)
                    // (0,0)=密切管理 high-inf+high-int, (0,1)=持續溝通 low-inf+high-int
                    // (1,0)=持續監控 high-inf+low-int,  (1,1)=最低關注 low-inf+low-int
                    if (q.row === 0 && q.col === 0) return highInf && highInt;
                    if (q.row === 0 && q.col === 1) return !highInf && highInt;
                    if (q.row === 1 && q.col === 0) return highInf && !highInt;
                    if (q.row === 1 && q.col === 1) return !highInf && !highInt;
                    return false;
                  })
                  .map((s, idx, arr) => {
                    // Spread dots within quadrant to avoid overlap
                    const angle = (2 * Math.PI * idx) / Math.max(arr.length, 1);
                    const radius = arr.length > 1 ? 20 : 0;
                    const cx = 50 + radius * Math.cos(angle);
                    const cy = 50 + radius * Math.sin(angle);

                    return (
                      <div
                        key={s.id}
                        className="absolute z-10"
                        style={{
                          left: `${cx}%`,
                          top: `${cy}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                        onMouseEnter={() => setHoveredId(s.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      >
                        <div
                          className={cn(
                            "w-3 h-3 rounded-full border border-white/50 shadow-sm cursor-default transition-transform",
                            ENGAGEMENT_COLOR[s.engagement ?? ""] ?? "bg-gray-400",
                            hoveredId === s.id && "scale-150"
                          )}
                        />
                        {/* Tooltip */}
                        {hoveredId === s.id && (
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-2 py-0.5 rounded whitespace-nowrap z-30 shadow-lg">
                            {s.name}
                            {s.engagement && ` (${ENGAGEMENT_LABEL[s.engagement] ?? s.engagement})`}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
          {/* Bottom labels */}
          <div className="flex items-center mt-0.5">
            <div className="w-6" />
            <div className="flex-1 flex justify-between px-1">
              <span className="text-[9px] text-muted-foreground">高</span>
              <span className="text-[9px] text-muted-foreground">低</span>
            </div>
          </div>
          <div className="text-center mt-0.5">
            <span className="text-[9px] text-muted-foreground">關注度 (Interest)</span>
          </div>
        </div>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2 justify-center">
        {Object.entries(ENGAGEMENT_COLOR).map(([key, color]) => (
          <div key={key} className="flex items-center gap-1">
            <div className={cn("w-2 h-2 rounded-full", color)} />
            <span className="text-[10px] text-muted-foreground">{ENGAGEMENT_LABEL[key] ?? key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
