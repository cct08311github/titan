"use client";

import { cn } from "@/lib/utils";
import { Clock, AlertTriangle, TrendingUp, CheckCircle2 } from "lucide-react";
import type { MonthlySummaryData } from "./use-monthly-timesheet";

type MonthlySummaryProps = {
  summary: MonthlySummaryData;
};

function StatCard({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border border-border rounded-lg bg-card p-3", className)}>
      <div className="flex items-center gap-2 mb-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

export function MonthlySummary({ summary }: MonthlySummaryProps) {
  const { teamOvertime, overtimeRanking, approvalProgress, members } = summary;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Team Overtime */}
      <StatCard title="團隊加班" icon={<Clock className="h-4 w-4 text-orange-500" />}>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">平日加班</span>
            <span className="font-mono">{teamOvertime.weekday.toFixed(1)}h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">假日加班</span>
            <span className="font-mono">{teamOvertime.holiday.toFixed(1)}h</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-border pt-1">
            <span>總計</span>
            <span className="font-mono">{teamOvertime.total.toFixed(1)}h</span>
          </div>
        </div>
      </StatCard>

      {/* Overtime Ranking */}
      <StatCard title="加班排名" icon={<TrendingUp className="h-4 w-4 text-blue-500" />}>
        {overtimeRanking.length === 0 ? (
          <p className="text-xs text-muted-foreground">本月無加班記錄</p>
        ) : (
          <div className="space-y-1 text-xs">
            {overtimeRanking.slice(0, 5).map((r) => (
              <div key={r.userId} className="flex justify-between">
                <span className="text-muted-foreground">
                  #{r.rank} {r.name}
                </span>
                <span className="font-mono">{r.totalOvertime.toFixed(1)}h</span>
              </div>
            ))}
          </div>
        )}
      </StatCard>

      {/* Missing Days */}
      <StatCard title="缺填工時" icon={<AlertTriangle className="h-4 w-4 text-yellow-500" />}>
        <div className="space-y-1 text-xs">
          {members.filter((m) => m.missingDayCount > 0).length === 0 ? (
            <p className="text-muted-foreground">全員已填寫完畢</p>
          ) : (
            members
              .filter((m) => m.missingDayCount > 0)
              .sort((a, b) => b.missingDayCount - a.missingDayCount)
              .slice(0, 5)
              .map((m) => (
                <div key={m.userId} className="flex justify-between">
                  <span className="text-muted-foreground">{m.name}</span>
                  <span className="font-mono text-yellow-600">{m.missingDayCount} 天</span>
                </div>
              ))
          )}
        </div>
      </StatCard>

      {/* Approval Progress */}
      <StatCard title="審核進度" icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">待審核</span>
            <span className="font-mono text-yellow-600">{approvalProgress.pending}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">已核准</span>
            <span className="font-mono text-green-600">{approvalProgress.approved}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">已駁回</span>
            <span className="font-mono text-red-600">{approvalProgress.rejected}</span>
          </div>
          {approvalProgress.total > 0 && (
            <div className="pt-1 border-t border-border">
              <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                <div
                  className="bg-green-500"
                  style={{ width: `${(approvalProgress.approved / approvalProgress.total) * 100}%` }}
                />
                <div
                  className="bg-red-500"
                  style={{ width: `${(approvalProgress.rejected / approvalProgress.total) * 100}%` }}
                />
              </div>
              <div className="text-center text-muted-foreground mt-1">
                {Math.round((approvalProgress.approved / approvalProgress.total) * 100)}% 完成
              </div>
            </div>
          )}
        </div>
      </StatCard>

      {/* Expected Hours Baseline */}
      {members.length > 0 && (
        <div className="md:col-span-2 lg:col-span-4">
          <StatCard title="應填工時 baseline" icon={<Clock className="h-4 w-4 text-muted-foreground" />}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
              {members.map((m) => {
                const pct = m.expectedHours > 0 ? (m.totalHours / m.expectedHours) * 100 : 0;
                return (
                  <div key={m.userId} className="flex items-center justify-between gap-1">
                    <span className="text-muted-foreground truncate">{m.name}</span>
                    <span className={cn(
                      "font-mono whitespace-nowrap",
                      pct >= 100 ? "text-green-600" : pct >= 80 ? "text-yellow-600" : "text-red-600"
                    )}>
                      {m.totalHours.toFixed(0)}/{m.expectedHours}h
                    </span>
                  </div>
                );
              })}
            </div>
          </StatCard>
        </div>
      )}
    </div>
  );
}
