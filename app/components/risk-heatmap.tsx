"use client";

/**
 * RiskHeatmap — 4x4 probability x impact heatmap for all project risks
 * Issue #1194 — PMO Visualizations
 */

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface RiskSummaryCell {
  probability: string;
  impact: string;
  score: number;
  count: number;
  risks: { id: string; title: string; projectCode: string; status: string }[];
}

interface Props {
  year: string;
}

const PROB_LABELS = ["LOW", "MEDIUM", "HIGH", "VERY_HIGH"] as const;
const IMPACT_LABELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const PROB_DISPLAY: Record<string, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
  VERY_HIGH: "極高",
};

const IMPACT_DISPLAY: Record<string, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
  CRITICAL: "極高",
};

// score → cell background color
function cellColor(score: number): string {
  if (score >= 12) return "bg-red-500/20 hover:bg-red-500/30 text-red-600 dark:text-red-400";
  if (score >= 8) return "bg-orange-500/20 hover:bg-orange-500/30 text-orange-600 dark:text-orange-400";
  if (score >= 4) return "bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-600 dark:text-yellow-400";
  return "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-600 dark:text-emerald-400";
}

export function RiskHeatmap({ year }: Props) {
  const [cells, setCells] = useState<RiskSummaryCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCell, setExpandedCell] = useState<string | null>(null); // "prob|impact"

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/risks-summary?year=${year}`);
      if (!res.ok) return;
      const body = await res.json();
      setCells(body.data ?? []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build lookup map
  const cellMap = new Map<string, RiskSummaryCell>();
  for (const c of cells) {
    cellMap.set(`${c.probability}|${c.impact}`, c);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        載入風險熱力圖...
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium mb-3">風險熱力圖（機率 x 影響）</p>
      <div className="flex">
        {/* Y-axis label */}
        <div className="flex flex-col items-center justify-center mr-1 w-5">
          <span
            className="text-[10px] text-muted-foreground"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            影響 (Impact)
          </span>
        </div>

        <div className="flex-1">
          {/* Grid: impact rows (top=CRITICAL) x probability cols (left=LOW) */}
          <div className="grid grid-cols-4 gap-0.5" style={{ maxWidth: 400 }}>
            {/* Render rows top-down: CRITICAL, HIGH, MEDIUM, LOW */}
            {[...IMPACT_LABELS].reverse().map((impact) =>
              PROB_LABELS.map((prob) => {
                const probNum = PROB_LABELS.indexOf(prob) + 1;
                const impactNum = IMPACT_LABELS.indexOf(impact) + 1;
                const score = probNum * impactNum;
                const key = `${prob}|${impact}`;
                const cell = cellMap.get(key);
                const count = cell?.count ?? 0;

                return (
                  <div key={key} className="relative">
                    <button
                      onClick={() => count > 0 && setExpandedCell(expandedCell === key ? null : key)}
                      className={cn(
                        "w-full aspect-square rounded-md flex flex-col items-center justify-center transition-colors border border-transparent",
                        cellColor(score),
                        count > 0 && "cursor-pointer border-border/30",
                        count === 0 && "opacity-50 cursor-default"
                      )}
                    >
                      <span className="text-lg font-bold tabular-nums">{count || ""}</span>
                      <span className="text-[9px] opacity-60">{score}</span>
                    </button>

                    {/* Expanded risk list popup */}
                    {expandedCell === key && cell && cell.risks.length > 0 && (
                      <div className="absolute top-full left-0 mt-1 z-30 bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[220px] max-h-[200px] overflow-y-auto">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium">
                            {PROB_DISPLAY[prob]} x {IMPACT_DISPLAY[impact]} ({count})
                          </span>
                          <button onClick={() => setExpandedCell(null)} className="text-muted-foreground hover:text-foreground">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {cell.risks.map((r) => (
                            <div key={r.id} className="text-xs">
                              <span className="text-muted-foreground font-mono mr-1">{r.projectCode}</span>
                              <span>{r.title}</span>
                              <span className={cn(
                                "ml-1 px-1 py-0.5 rounded text-[10px]",
                                r.status === "OPEN" ? "bg-red-500/10 text-red-500" :
                                r.status === "CLOSED" ? "bg-emerald-500/10 text-emerald-500" :
                                "bg-yellow-500/10 text-yellow-500"
                              )}>
                                {r.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* X-axis labels */}
          <div className="grid grid-cols-4 gap-0.5 mt-1" style={{ maxWidth: 400 }}>
            {PROB_LABELS.map((p) => (
              <div key={p} className="text-center text-[10px] text-muted-foreground">
                {PROB_DISPLAY[p]}
              </div>
            ))}
          </div>
          <div className="text-center mt-0.5" style={{ maxWidth: 400 }}>
            <span className="text-[10px] text-muted-foreground">機率 (Probability)</span>
          </div>
        </div>

        {/* Y-axis labels (right side) */}
        <div className="flex flex-col gap-0.5 ml-1 justify-center" style={{ height: "auto" }}>
          {[...IMPACT_LABELS].reverse().map((imp) => (
            <div key={imp} className="flex items-center h-full min-h-[40px]">
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {IMPACT_DISPLAY[imp]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
