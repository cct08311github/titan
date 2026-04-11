"use client";

/**
 * Reports v2 Page — Issue #964
 *
 * Orchestrator: holds active-report + date-range state, delegates rendering to
 * report-filters.tsx (sidebar nav), report-charts.tsx (P0 chart reports), and
 * report-table.tsx (HR / audit / project table reports).
 */

import { useState } from "react";
import { Calendar } from "lucide-react";
import { ReportSidebarNav, type ReportId, ORIGINAL_REPORT_IDS } from "@/app/components/reports/report-filters";
import {
  UtilizationReport,
  VelocityReport,
  KPITrendReport,
  UnplannedTrendReport,
} from "@/app/components/reports/report-charts";
import {
  TimeSummaryReport,
  OvertimeReport,
} from "@/app/components/reports/report-table";
import {
  AuditSummaryReport,
  LoginActivityReport,
  ProjectStatusReport,
  ProjectBudgetReport,
} from "@/app/components/reports/report-table-audit";
import { ReportsExtended } from "@/app/components/reports-extended";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function defaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  return {
    from: from.toISOString().split("T")[0],
    to: now.toISOString().split("T")[0],
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsV2Page() {
  const [activeReport, setActiveReport] = useState<ReportId>("utilization");
  const [dateRange, setDateRange] = useState(defaultDateRange);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4">
      {/* Left sidebar nav */}
      <ReportSidebarNav activeReport={activeReport} onSelect={setActiveReport} />

      {/* Right content */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="lg:hidden">
          <h1 className="text-lg font-semibold tracking-tight">報表</h1>
        </div>

        {/* Date range + year picker */}
        <div className="flex flex-wrap items-center gap-2 px-1">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            aria-label="開始日期"
            value={dateRange.from}
            onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
            className="bg-background border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">~</span>
          <input
            type="date"
            aria-label="結束日期"
            value={dateRange.to}
            onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
            className="bg-background border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground ml-2">年度</span>
          <input
            type="number"
            aria-label="報表年度"
            value={reportYear}
            onChange={(e) => setReportYear(parseInt(e.target.value) || new Date().getFullYear())}
            className="bg-background border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring w-20"
          />
        </div>

        {/* Report content */}
        <div className="border border-border rounded-xl bg-card p-4 sm:p-6 min-h-[400px]">
          {activeReport === "utilization" && (
            <UtilizationReport from={dateRange.from} to={dateRange.to} />
          )}
          {activeReport === "velocity" && (
            <VelocityReport from={dateRange.from} to={dateRange.to} />
          )}
          {activeReport === "kpi-trend" && (
            <KPITrendReport from={dateRange.from} to={dateRange.to} />
          )}
          {activeReport === "unplanned" && (
            <UnplannedTrendReport from={dateRange.from} to={dateRange.to} />
          )}
          {activeReport === "time-summary" && (
            <TimeSummaryReport from={dateRange.from} to={dateRange.to} />
          )}
          {activeReport === "overtime" && (
            <OvertimeReport from={dateRange.from} to={dateRange.to} />
          )}
          {activeReport === "audit-summary" && (
            <AuditSummaryReport from={dateRange.from} to={dateRange.to} />
          )}
          {activeReport === "login-activity" && (
            <LoginActivityReport from={dateRange.from} to={dateRange.to} />
          )}
          {activeReport === "project-status" && (
            <ProjectStatusReport />
          )}
          {activeReport === "project-budget" && (
            <ProjectBudgetReport />
          )}
          {!ORIGINAL_REPORT_IDS.has(activeReport) && (
            <ReportsExtended
              activeReport={activeReport}
              from={dateRange.from}
              to={dateRange.to}
              year={reportYear}
            />
          )}
        </div>
      </div>
    </div>
  );
}
