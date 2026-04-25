"use client";

/**
 * YourWeekWidget — Issue #1518 (Phase 3 of #1505 team-love initiative)
 *
 * Personal weekly summary with positive framing. Four metrics: completed
 * tasks, hours logged, active days, KPI achievement. No leaderboard, no
 * negative comparison.
 */

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Flame, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";

type Summary = {
  weekStart: string;
  completedTasks: { current: number; previous: number; delta: number };
  hoursLogged: { current: number; previous: number; delta: number };
  activeDays: number;
  kpiAchievement: { averagePct: number; hasActive: boolean };
};

interface StatBlockProps {
  icon: React.ReactNode;
  label: string;
  primary: string;
  secondary?: string;
  tone?: "positive" | "neutral";
}

function StatBlock({ icon, label, primary, secondary, tone = "neutral" }: StatBlockProps) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-muted/40">
      <div
        aria-hidden="true"
        className={cn(
          "h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0",
          tone === "positive"
            ? "bg-primary/15 text-primary"
            : "bg-foreground/10 text-foreground/70"
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold leading-tight">{primary}</div>
        {secondary && <div className="text-[11px] text-muted-foreground mt-0.5">{secondary}</div>}
      </div>
    </div>
  );
}

function celebrationFor(s: Summary): string | null {
  // Pick the most encouraging metric; skip when nothing happened yet.
  if (s.completedTasks.current > 0 && s.completedTasks.delta > 0) {
    return `🎉 本週完成 ${s.completedTasks.current} 個任務，比上週多 ${s.completedTasks.delta} 個`;
  }
  if (s.activeDays >= 5) {
    return `🔥 本週已活躍 ${s.activeDays} 天，節奏穩穩的`;
  }
  if (s.hoursLogged.current > 0 && s.hoursLogged.delta > 0) {
    const delta = s.hoursLogged.delta.toFixed(1);
    return `⏱️ 本週投入 ${s.hoursLogged.current.toFixed(1)} 小時，比上週多 ${delta} 小時`;
  }
  if (s.completedTasks.current > 0) {
    return `✅ 本週已完成 ${s.completedTasks.current} 個任務`;
  }
  return null;
}

function deltaText(delta: number, unit: string): string {
  if (delta === 0) return `與上週相同`;
  if (delta > 0) return `比上週多 ${delta}${unit}`;
  return `比上週少 ${Math.abs(delta)}${unit}`;
}

export function YourWeekWidget() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/your-week")
      .then(async (res) => {
        if (!res.ok) throw new Error("failed");
        const body = await res.json();
        const data = extractData<Summary>(body);
        if (!cancelled && data) setSummary(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-card rounded-xl shadow-card p-5 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted/60 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !summary) return null;

  const celebration = celebrationFor(summary);

  return (
    <section
      aria-labelledby="your-week-title"
      className="bg-card rounded-xl shadow-card p-5"
    >
      <header className="flex items-baseline justify-between mb-3">
        <h2 id="your-week-title" className="text-sm font-semibold">
          本週你
        </h2>
        <span className="text-[11px] text-muted-foreground">
          自 {summary.weekStart}
        </span>
      </header>

      {celebration && (
        <p className="mb-3 text-sm text-foreground/90">{celebration}</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatBlock
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="完成任務"
          primary={String(summary.completedTasks.current)}
          secondary={deltaText(summary.completedTasks.delta, " 個")}
          tone={summary.completedTasks.delta > 0 ? "positive" : "neutral"}
        />
        <StatBlock
          icon={<Clock className="h-4 w-4" />}
          label="投入工時"
          primary={`${summary.hoursLogged.current.toFixed(1)} h`}
          secondary={deltaText(summary.hoursLogged.delta, " h")}
          tone={summary.hoursLogged.delta > 0 ? "positive" : "neutral"}
        />
        <StatBlock
          icon={<Flame className="h-4 w-4" />}
          label="活躍天數"
          primary={`${summary.activeDays} / 7`}
          secondary={summary.activeDays >= 5 ? "穩定的節奏" : "本週還有時間"}
          tone={summary.activeDays >= 5 ? "positive" : "neutral"}
        />
        {summary.kpiAchievement.hasActive ? (
          <StatBlock
            icon={<Target className="h-4 w-4" />}
            label="KPI 達成"
            primary={`${summary.kpiAchievement.averagePct}%`}
            secondary={
              summary.kpiAchievement.averagePct >= 90
                ? "接近目標"
                : summary.kpiAchievement.averagePct >= 70
                ? "穩步前進"
                : "持續努力中"
            }
            tone={summary.kpiAchievement.averagePct >= 80 ? "positive" : "neutral"}
          />
        ) : (
          <StatBlock
            icon={<Target className="h-4 w-4" />}
            label="KPI 達成"
            primary="—"
            secondary="尚無 active KPI"
          />
        )}
      </div>
    </section>
  );
}
