"use client";

import { cn } from "@/lib/utils";
import { safeFixed } from "@/lib/safe-number";

type CategoryBreakdown = {
  category: string;
  hours: number;
  pct: number;
};

type TimeSummaryProps = {
  totalHours: number;
  breakdown: CategoryBreakdown[];
  taskInvestmentRate: number;
};

const CAT_META: Record<string, { label: string; barClass: string; bgClass: string }> = {
  PLANNED_TASK: { label: "原始規劃", barClass: "bg-blue-500", bgClass: "bg-blue-500/10 border-blue-500/20" },
  ADDED_TASK:   { label: "追加任務", barClass: "bg-orange-500", bgClass: "bg-orange-500/10 border-orange-500/20" },
  INCIDENT:     { label: "突發事件", barClass: "bg-red-500", bgClass: "bg-red-500/10 border-red-500/20" },
  SUPPORT:      { label: "用戶支援", barClass: "bg-purple-500", bgClass: "bg-purple-500/10 border-purple-500/20" },
  ADMIN:        { label: "行政庶務", barClass: "bg-zinc-500", bgClass: "bg-zinc-500/10 border-zinc-500/20" },
  LEARNING:     { label: "學習成長", barClass: "bg-emerald-500", bgClass: "bg-emerald-500/10 border-emerald-500/20" },
};

export function TimeSummary({ totalHours, breakdown, taskInvestmentRate }: TimeSummaryProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
      {/* Header totals */}
      <div className="flex items-center gap-6">
        <div>
          <div className="text-2xl font-bold text-zinc-100 tabular-nums">{safeFixed(totalHours, 1)}</div>
          <div className="text-xs text-zinc-500 mt-0.5">本週總工時</div>
        </div>
        <div className="h-10 w-px bg-zinc-800" />
        <div>
          <div className="text-2xl font-bold text-emerald-400 tabular-nums">{taskInvestmentRate}%</div>
          <div className="text-xs text-zinc-500 mt-0.5">任務投入率</div>
        </div>
      </div>

      {/* Stacked bar */}
      {totalHours > 0 && (
        <div className="h-3 rounded-full overflow-hidden flex gap-px">
          {breakdown
            .filter((b) => b.pct > 0)
            .map((b) => (
              <div
                key={b.category}
                className={cn("h-full transition-all", CAT_META[b.category]?.barClass ?? "bg-zinc-500")}
                style={{ width: `${b.pct}%` }}
                title={`${CAT_META[b.category]?.label}: ${b.hours}h (${b.pct}%)`}
              />
            ))}
        </div>
      )}

      {/* Category rows */}
      <div className="space-y-2">
        {breakdown.map((b) => {
          const meta = CAT_META[b.category];
          if (!meta) return null;
          return (
            <div key={b.category} className="flex items-center gap-3">
              <div className={cn("flex items-center gap-2 flex-1 px-2.5 py-1.5 rounded-lg border text-xs", meta.bgClass)}>
                <span className={cn("w-2 h-2 rounded-full flex-shrink-0", meta.barClass)} />
                <span className="text-zinc-300 font-medium">{meta.label}</span>
              </div>
              <div className="text-right min-w-[48px]">
                <span className={cn("text-xs font-semibold tabular-nums", b.hours > 0 ? "text-zinc-200" : "text-zinc-700")}>
                  {b.hours > 0 ? `${safeFixed(b.hours, 1)}h` : "—"}
                </span>
              </div>
              <div className="w-8 text-right">
                <span className="text-xs text-zinc-600 tabular-nums">
                  {b.pct > 0 ? `${b.pct}%` : ""}
                </span>
              </div>
              {/* Mini bar */}
              <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", meta.barClass)}
                  style={{ width: `${b.pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
