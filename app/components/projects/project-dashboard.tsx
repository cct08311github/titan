"use client";

import type { DashboardStats } from "@/app/(app)/projects/types";

interface DashboardBarProps {
  stats: DashboardStats | null;
}

export function DashboardBar({ stats }: DashboardBarProps) {
  if (!stats) return null;

  const onTrack = stats.byStatus
    .filter((s) =>
      [
        "REQUIREMENTS",
        "DESIGN",
        "DEVELOPMENT",
        "TESTING",
        "DEPLOYMENT",
        "WARRANTY",
        "SCHEDULED",
      ].includes(s.status)
    )
    .reduce((acc, s) => acc + s.count, 0);

  const gateBlocked =
    stats.byStatus.find((s) => s.status === "ON_HOLD")?.count ?? 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      <div className="bg-card rounded-xl shadow-card p-4 text-center">
        <p className="text-2xl font-semibold tabular-nums">{stats.total}</p>
        <p className="text-xs text-muted-foreground mt-1">項目總數</p>
      </div>
      <div className="bg-card rounded-xl shadow-card p-4 text-center">
        <p className="text-2xl font-semibold tabular-nums text-emerald-500">
          {onTrack}
        </p>
        <p className="text-xs text-muted-foreground mt-1">進行中</p>
      </div>
      <div className="bg-card rounded-xl shadow-card p-4 text-center">
        <p className="text-2xl font-semibold tabular-nums text-orange-500">
          {stats.openRisks}
        </p>
        <p className="text-xs text-muted-foreground mt-1">未結風險</p>
      </div>
      <div className="bg-card rounded-xl shadow-card p-4 text-center">
        <p className="text-2xl font-semibold tabular-nums">
          {stats.avgProgress}%
        </p>
        <p className="text-xs text-muted-foreground mt-1">平均進度</p>
      </div>
      <div className="bg-card rounded-xl shadow-card p-4 text-center">
        <p className="text-2xl font-semibold tabular-nums text-amber-500">
          {gateBlocked}
        </p>
        <p className="text-xs text-muted-foreground mt-1">暫停中</p>
      </div>
    </div>
  );
}
