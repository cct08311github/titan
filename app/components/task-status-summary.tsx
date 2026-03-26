"use client";

import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, Minus, ClipboardList, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";
import { SkeletonBar, PageError } from "@/app/components/page-states";
import { useRouter } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────

interface StatusMetric {
  count: number;
  trend: "up" | "down" | "same";
  diff: number;
}

interface TaskSummaryData {
  todo: StatusMetric;
  inProgress: StatusMetric;
  done: StatusMetric;
  scope: "team" | "personal";
}

// ── Card Config ────────────────────────────────────────────────────────────

interface CardConfig {
  key: "todo" | "inProgress" | "done";
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  filterStatus: string;
}

const CARDS: CardConfig[] = [
  {
    key: "todo",
    label: "待辦",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    filterStatus: "TODO",
  },
  {
    key: "inProgress",
    label: "進行中",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/20",
    filterStatus: "IN_PROGRESS",
  },
  {
    key: "done",
    label: "已完成",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    filterStatus: "DONE",
  },
];

// ── Trend Icon ─────────────────────────────────────────────────────────────

function TrendIndicator({ trend, diff }: { trend: "up" | "down" | "same"; diff: number }) {
  if (trend === "same") {
    return (
      <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
        <Minus className="h-3 w-3" />
        持平
      </span>
    );
  }

  const isUp = trend === "up";
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-[11px] font-medium",
        isUp ? "text-orange-500" : "text-green-500"
      )}
    >
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? "+" : ""}
      {diff} 較上週
    </span>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-card rounded-xl shadow-card p-4 space-y-2">
          <SkeletonBar className="h-3 w-12" />
          <SkeletonBar className="h-8 w-16" />
          <SkeletonBar className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function TaskStatusSummary() {
  const [data, setData] = useState<TaskSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/metrics/task-summary?period=week");
      if (!res.ok) throw new Error("無法載入任務統計");
      const body = await res.json();
      const result = extractData<TaskSummaryData>(body);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  if (loading) return <SummarySkeleton />;
  if (error) return <PageError message={error} onRetry={fetchSummary} className="py-4" />;
  if (!data) return null;

  return (
    <div>
      <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-primary" />
        {data.scope === "team" ? "團隊任務摘要" : "個人任務摘要"}
        <span className="text-xs text-muted-foreground font-normal">（本週統計）</span>
      </h2>
      <div className="grid grid-cols-3 gap-4">
        {CARDS.map((card) => {
          const metric = data[card.key];
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => router.push(`/kanban?status=${card.filterStatus}`)}
              className={cn(
                "bg-card rounded-xl shadow-card p-4 text-left transition-all",
                "hover:shadow-card-hover hover:-translate-y-px",
                "border",
                card.borderColor
              )}
            >
              <p className={cn("text-xs font-medium", card.color)}>{card.label}</p>
              <p className="text-3xl font-bold tabular-nums mt-1 text-foreground">
                {metric.count}
              </p>
              <div className="mt-2">
                <TrendIndicator trend={metric.trend} diff={metric.diff} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
