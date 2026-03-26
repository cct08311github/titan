"use client";

import { cn } from "@/lib/utils";
import { KPIChart } from "./kpi-chart";

interface KPIAchievement {
  id: string;
  period: string;
  actualValue: number;
}

interface KPIDashboardItem {
  id: string;
  code: string;
  title: string;
  target: number;
  actual: number;
  unit?: string | null;
  status: string;
  frequency: string;
  achievements?: KPIAchievement[];
}

interface KPIDashboardCardProps {
  kpi: KPIDashboardItem;
  achievementRate: number;
}

function getStatusColor(rate: number): string {
  if (rate >= 90) return "text-green-500";
  if (rate >= 60) return "text-yellow-500";
  return "text-red-500";
}

function getStatusBg(rate: number): string {
  if (rate >= 90) return "bg-green-500/10";
  if (rate >= 60) return "bg-yellow-500/10";
  return "bg-red-500/10";
}

const FREQUENCY_LABEL: Record<string, string> = {
  MONTHLY: "月報",
  QUARTERLY: "季報",
  YEARLY: "年報",
};

/**
 * KPI 儀表板卡片 — 顯示單一 KPI 的圖表和達成率
 */
export function KPIDashboardCard({ kpi, achievementRate }: KPIDashboardCardProps) {
  const hasData = kpi.achievements && kpi.achievements.length > 0;
  const statusColor = getStatusColor(achievementRate);
  const statusBg = getStatusBg(achievementRate);

  return (
    <div className="bg-card rounded-xl shadow-card p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-mono text-muted-foreground">{kpi.code}</p>
          <p className="text-sm font-medium text-foreground truncate mt-0.5" title={kpi.title}>
            {kpi.title}
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground ml-2 flex-shrink-0">
          {FREQUENCY_LABEL[kpi.frequency] ?? kpi.frequency}
        </span>
      </div>

      {/* Chart */}
      <div className="flex-1 flex items-center justify-center">
        {hasData ? (
          <KPIChart
            target={kpi.target}
            actual={kpi.actual}
            unit={kpi.unit}
            achievementRate={achievementRate}
          />
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">尚未填報</p>
          </div>
        )}
      </div>

      {/* Footer: target vs actual */}
      <div className="mt-2 flex items-center justify-between text-xs">
        <div className="text-muted-foreground">
          目標: {kpi.target}{kpi.unit ? ` ${kpi.unit}` : ""}
        </div>
        <div className={cn("font-medium", statusColor)}>
          實際: {hasData ? `${kpi.actual}${kpi.unit ? ` ${kpi.unit}` : ""}` : "--"}
        </div>
      </div>

      {/* Achievement rate badge */}
      <div className="mt-2 flex justify-center">
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", statusColor, statusBg)}>
          {hasData ? `達成率 ${Math.round(achievementRate)}%` : "尚未填報"}
        </span>
      </div>
    </div>
  );
}
