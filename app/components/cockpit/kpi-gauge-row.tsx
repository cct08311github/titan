"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface KPISummary {
  id: string;
  code: string;
  name: string;
  targetValue: number;
  actualValue: number;
  achievementRate: number;
}

interface KPIGaugeRowProps {
  kpis: KPISummary[];
}

function getBarColor(rate: number): string {
  if (rate >= 80) return "bg-green-500";
  if (rate >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function getTextColor(rate: number): string {
  if (rate >= 80) return "text-green-700 dark:text-green-400";
  if (rate >= 50) return "text-yellow-700 dark:text-yellow-400";
  return "text-red-700 dark:text-red-400";
}

export function KPIGaugeRow({ kpis }: KPIGaugeRowProps) {
  if (kpis.length === 0) {
    return (
      <div data-testid="kpi-gauge-row">
        <h3 className="text-sm font-semibold text-foreground mb-3">KPI 達成</h3>
        <p className="text-sm text-muted-foreground">尚無關聯 KPI</p>
      </div>
    );
  }

  return (
    <div data-testid="kpi-gauge-row">
      <h3 className="text-sm font-semibold text-foreground mb-3">KPI 達成</h3>
      <div className="space-y-2.5">
        {kpis.map((kpi) => (
          <Link key={kpi.id} href="/kpi" className="group block hover:bg-accent/40 -mx-1 px-1 rounded transition-colors">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground truncate mr-2">
                <span className="font-mono text-xs">{kpi.code}</span>{" "}
                {kpi.name}
              </span>
              <span className={cn("font-medium tabular-nums flex-shrink-0", getTextColor(kpi.achievementRate))}>
                {kpi.achievementRate}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", getBarColor(kpi.achievementRate))}
                style={{ width: `${Math.min(100, kpi.achievementRate)}%` }}
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
