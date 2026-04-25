"use client";

/**
 * ReportsExtended — thin router that delegates each report key to its own file.
 * Issue: T1272 (feat/T1272-remaining-api-ui)
 *
 * Sub-report components live in app/components/reports/report-*.tsx.
 * Shared primitives are in app/components/reports/report-shared.tsx.
 */

import { CompletionRateReport } from "./reports/report-completion";
import { CustomReport } from "./reports/report-custom";
import { DelayChangeReport } from "./reports/report-delay-change";
import { DepartmentTimesheetReport } from "./reports/report-dept-timesheet";
import { KpiReport } from "./reports/report-kpi";
import { MonthlyReport } from "./reports/report-monthly";
import { TimeDistributionReport } from "./reports/report-time-distribution";
import { TimesheetComplianceReport } from "./reports/report-timesheet-compliance";
import { TrendsReport } from "./reports/report-trends";
import { WeeklyReport } from "./reports/report-weekly";
import { WeeklyPivotReport } from "./reports/report-weekly-pivot";
import { MonthlyPivotReport } from "./reports/report-monthly-pivot";
import { WorkloadReport } from "./reports/report-workload";
import { V2ChangeSummaryReport } from "./reports/report-v2-change-summary";
import { V2EarnedValueReport } from "./reports/report-v2-earned-value";
import { V2IncidentSlaReport } from "./reports/report-v2-incident-sla";
import { V2KpiCompositeReport } from "./reports/report-v2-kpi-composite";
import { V2KpiCorrelationReport } from "./reports/report-v2-kpi-correlation";
import { V2MilestoneAchievementReport } from "./reports/report-v2-milestone";
import { V2OverdueAnalysisReport } from "./reports/report-v2-overdue";
import { V2OvertimeAnalysisReport } from "./reports/report-v2-overtime";
import { V2PermissionAuditReport } from "./reports/report-v2-permission-audit";
import { V2TimeEfficiencyReport } from "./reports/report-v2-time-efficiency";
import { V2WorkloadDistributionReport } from "./reports/report-v2-workload-distribution";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ReportsExtendedProps {
  activeReport: string;
  from: string;
  to: string;
  year: number;
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export function ReportsExtended({ activeReport, from, to, year }: ReportsExtendedProps) {
  switch (activeReport) {
    // 完成率
    case "completion-rate":
      return <CompletionRateReport from={from} to={to} />;

    // 工時詳細
    case "department-timesheet":
      return <DepartmentTimesheetReport from={from} />;
    case "time-distribution":
      return <TimeDistributionReport from={from} to={to} />;
    case "timesheet-compliance":
      return <TimesheetComplianceReport from={from} to={to} />;
    case "weekly":
      return <WeeklyReport from={from} />;
    case "monthly":
      return <MonthlyReport from={from} />;
    case "weekly-pivot":
      return <WeeklyPivotReport from={from} />;
    case "monthly-pivot":
      return <MonthlyPivotReport from={from} />;

    // 分析
    case "delay-change":
      return <DelayChangeReport from={from} to={to} />;
    case "workload":
      return <WorkloadReport from={from} to={to} />;
    case "custom":
      return <CustomReport from={from} to={to} />;
    case "trends":
      return <TrendsReport year={year} />;
    case "kpi":
      return <KpiReport year={year} />;

    // V2 進階
    case "v2-change-summary":
      return <V2ChangeSummaryReport from={from} to={to} />;
    case "v2-earned-value":
      return <V2EarnedValueReport from={from} />;
    case "v2-incident-sla":
      return <V2IncidentSlaReport from={from} to={to} />;
    case "v2-kpi-composite":
      return <V2KpiCompositeReport year={year} />;
    case "v2-kpi-correlation":
      return <V2KpiCorrelationReport year={year} />;
    case "v2-milestone-achievement":
      return <V2MilestoneAchievementReport year={year} />;
    case "v2-overdue-analysis":
      return <V2OverdueAnalysisReport from={from} to={to} />;
    case "v2-overtime-analysis":
      return <V2OvertimeAnalysisReport from={from} to={to} />;
    case "v2-permission-audit":
      return <V2PermissionAuditReport from={from} to={to} />;
    case "v2-time-efficiency":
      return <V2TimeEfficiencyReport from={from} to={to} />;
    case "v2-workload-distribution":
      return <V2WorkloadDistributionReport from={from} to={to} />;

    default:
      return null;
  }
}
