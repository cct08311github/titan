"use client";

/**
 * ManagerTodayCard — Issue #1323
 *
 * 「今日必辦」widget for Manager/Admin dashboard.
 * Shows 4 actionable stat tiles that refresh every 5 minutes.
 * Hides itself when all counts are 0 to reduce visual noise.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ClipboardCheck, AlertTriangle, Calendar, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SkeletonBar } from "@/app/components/page-states";

// ── Types ──────────────────────────────────────────────────────────────────

interface ManagerTodayData {
  pendingApprovals: {
    timesheet: number;
    documents: number;
  };
  teamOverdue: number;
  dueToday: number;
  kpiBehind: number;
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div
      className="bg-card rounded-xl shadow-card p-5"
      aria-busy="true"
      aria-label="載入今日必辦中"
    >
      <SkeletonBar className="h-4 w-24 mb-4" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <SkeletonBar className="h-7 w-10" />
            <SkeletonBar className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stat Tile ──────────────────────────────────────────────────────────────

interface StatTileProps {
  count: number;
  label: string;
  href: string;
  icon: React.ReactNode;
  colorClass: string;
  badgeClass: string;
}

function StatTile({ count, label, href, icon, colorClass, badgeClass }: StatTileProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col gap-2 p-3 rounded-lg border transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        badgeClass
      )}
    >
      <div className={cn("flex items-center gap-1.5", colorClass)}>
        {icon}
        <span className="text-2xl font-bold tabular-nums leading-none">{count}</span>
      </div>
      <span className="text-xs text-muted-foreground leading-snug">{label}</span>
    </Link>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function ManagerTodayCard() {
  const [data, setData] = useState<ManagerTodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/manager-today");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const payload: ManagerTodayData = body?.data ?? body;
      setData(payload);
      setError(null);
    } catch (e) {
      // Graceful degradation — don't expose error to users
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();

    // Auto-refresh every 5 minutes
    timerRef.current = setInterval(() => {
      void fetchData();
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, [fetchData]);

  if (loading) return <CardSkeleton />;

  // Graceful error / partial data — don't break the dashboard
  if (error || !data || !data.pendingApprovals) return null;

  const totalApprovals = (data.pendingApprovals.timesheet ?? 0) + (data.pendingApprovals.documents ?? 0);
  const teamOverdue = data.teamOverdue ?? 0;
  const dueToday = data.dueToday ?? 0;
  const kpiBehind = data.kpiBehind ?? 0;
  const allZero = totalApprovals === 0 && teamOverdue === 0 && dueToday === 0 && kpiBehind === 0;

  // Hide when nothing needs attention
  if (allZero) return null;

  const tiles: StatTileProps[] = [
    {
      count: totalApprovals,
      label: "待核准筆數",
      href: "/approvals",
      icon: <ClipboardCheck className="h-4 w-4" />,
      colorClass: "text-red-600 dark:text-red-400",
      badgeClass: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
    },
    {
      count: teamOverdue,
      label: "團隊逾期任務",
      href: "/kanban?filter=overdue&scope=team",
      icon: <AlertTriangle className="h-4 w-4" />,
      colorClass: "text-amber-600 dark:text-amber-400",
      badgeClass: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
    },
    {
      count: dueToday,
      label: "今日到期任務",
      href: "/kanban?filter=dueToday&scope=team",
      icon: <Calendar className="h-4 w-4" />,
      colorClass: "text-blue-600 dark:text-blue-400",
      badgeClass: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
    },
    {
      count: kpiBehind,
      label: "KPI 落後項目",
      href: "/kpi",
      icon: <TrendingDown className="h-4 w-4" />,
      colorClass: "text-green-700 dark:text-green-400",
      badgeClass: "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800",
    },
  ];

  return (
    <div className="bg-card rounded-xl shadow-card p-5">
      <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-primary" />
        今日必辦
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map((tile) => (
          <StatTile key={tile.href} {...tile} />
        ))}
      </div>
    </div>
  );
}

export default React.memo(ManagerTodayCard);
