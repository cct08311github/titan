"use client";

/**
 * Lazy-loaded ECharts wrapper (Issue #970)
 *
 * Uses dynamic import to avoid loading the 800KB+ ECharts bundle
 * on pages that don't need charts.
 */

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

function ChartLoading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

// Lazy load the KPI chart component
export const LazyKPIChart = dynamic(
  () => import("@/app/components/kpi-chart").then((mod) => ({ default: mod.KPIChart })),
  { loading: ChartLoading, ssr: false }
);

// Lazy load the completion rate chart
export const LazyCompletionRateChart = dynamic(
  () => import("@/app/components/completion-rate-chart").then((mod) => ({ default: mod.CompletionRateChart })),
  { loading: ChartLoading, ssr: false }
);

// Lazy load the timesheet distribution chart
export const LazyTimesheetDistributionChart = dynamic(
  () => import("@/app/components/timesheet-distribution-chart").then((mod) => ({ default: mod.TimesheetDistributionChart })),
  { loading: ChartLoading, ssr: false }
);
