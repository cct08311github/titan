"use client";

/**
 * ReportSidebarNav — left sidebar navigation extracted from reports/page.tsx
 * Receives the full category config and active report state as props.
 */

import {
  Users,
  TrendingUp,
  AlertTriangle,
  Target,
  Calendar,
  BarChart3,
  FolderKanban,
  Clock,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReportId =
  | "utilization" | "velocity" | "kpi-trend" | "unplanned"
  | "time-summary" | "overtime" | "audit-summary" | "login-activity" | "project-status" | "project-budget"
  | "completion-rate"
  | "department-timesheet" | "time-distribution" | "timesheet-compliance" | "weekly" | "monthly" | "weekly-pivot" | "monthly-pivot"
  | "delay-change" | "workload" | "custom" | "trends" | "kpi"
  | "v2-change-summary" | "v2-earned-value" | "v2-incident-sla" | "v2-kpi-composite"
  | "v2-kpi-correlation" | "v2-milestone-achievement" | "v2-overdue-analysis"
  | "v2-overtime-analysis" | "v2-permission-audit" | "v2-time-efficiency" | "v2-workload-distribution";

export interface ReportNav {
  id: ReportId;
  label: string;
  icon: typeof Users;
  description: string;
}

export interface ReportCategory {
  label: string;
  icon: typeof Users;
  reports: ReportNav[];
}

export const REPORT_CATEGORIES: ReportCategory[] = [
  {
    label: "組織績效",
    icon: BarChart3,
    reports: [
      { id: "utilization", label: "團隊利用率", icon: Users, description: "工時投入 / 可用工時" },
      { id: "velocity", label: "任務速率", icon: TrendingUp, description: "每週完成任務數趨勢" },
    ],
  },
  {
    label: "項目管理",
    icon: FolderKanban,
    reports: [
      { id: "unplanned", label: "計畫外工作趨勢", icon: AlertTriangle, description: "計畫外占比月趨勢" },
      { id: "project-status", label: "項目狀態分佈", icon: FolderKanban, description: "按狀態統計項目數量" },
      { id: "project-budget", label: "預算執行率", icon: TrendingUp, description: "各項目預算 vs 實際花費" },
    ],
  },
  {
    label: "KPI",
    icon: Target,
    reports: [
      { id: "kpi-trend", label: "KPI 達成率趨勢", icon: Target, description: "月度 KPI 達成率 + 預測" },
    ],
  },
  {
    label: "工時",
    icon: Clock,
    reports: [
      { id: "time-summary", label: "工時摘要", icon: Clock, description: "個人/團隊工時統計" },
      { id: "overtime", label: "加班分析", icon: TrendingUp, description: "正常/加班/假日工時佔比" },
    ],
  },
  {
    label: "稽核",
    icon: Shield,
    reports: [
      { id: "audit-summary", label: "操作日誌統計", icon: Shield, description: "按操作類型統計" },
      { id: "login-activity", label: "登入活動", icon: Users, description: "登入成功/失敗統計" },
    ],
  },
  {
    label: "完成率",
    icon: Target,
    reports: [
      { id: "completion-rate", label: "任務完成率趨勢", icon: TrendingUp, description: "月度任務完成比率" },
    ],
  },
  {
    label: "工時詳細",
    icon: Clock,
    reports: [
      { id: "department-timesheet", label: "部門工時表", icon: Clock, description: "部門週工時彙整" },
      { id: "time-distribution", label: "工時分佈", icon: BarChart3, description: "各類工時分佈比較" },
      { id: "timesheet-compliance", label: "工時合規", icon: Shield, description: "填報合規率統計" },
      { id: "weekly", label: "週報", icon: Calendar, description: "週度工作摘要" },
      { id: "monthly", label: "月報", icon: Calendar, description: "月度工作摘要" },
      { id: "weekly-pivot", label: "週報摘要 (Pivot)", icon: BarChart3, description: "人員 × 類別週度 Pivot" },
      { id: "monthly-pivot", label: "月報摘要 (Pivot)", icon: BarChart3, description: "人員 × 類別月度 Pivot" },
    ],
  },
  {
    label: "分析",
    icon: BarChart3,
    reports: [
      { id: "delay-change", label: "延遲變化分析", icon: AlertTriangle, description: "延遲任務統計與趨勢" },
      { id: "workload", label: "工作量分析", icon: Users, description: "個人任務負荷分佈" },
      { id: "custom", label: "自訂查詢", icon: FolderKanban, description: "按類別與狀態過濾" },
      { id: "trends", label: "跨年趨勢", icon: TrendingUp, description: "指標跨年度對比" },
      { id: "kpi", label: "KPI 報表", icon: Target, description: "年度 KPI 達成概況" },
    ],
  },
  {
    label: "V2 進階",
    icon: BarChart3,
    reports: [
      { id: "v2-change-summary", label: "變更摘要", icon: FolderKanban, description: "任務/計畫變更記錄" },
      { id: "v2-earned-value", label: "實獲值分析", icon: TrendingUp, description: "EVM 績效指標" },
      { id: "v2-incident-sla", label: "事件 SLA", icon: AlertTriangle, description: "事件處理時效達標率" },
      { id: "v2-kpi-composite", label: "KPI 綜合", icon: Target, description: "各類別 KPI 綜合統計" },
      { id: "v2-kpi-correlation", label: "KPI 相關性", icon: TrendingUp, description: "KPI 指標相關係數" },
      { id: "v2-milestone-achievement", label: "里程碑達成", icon: Target, description: "里程碑按時完成情況" },
      { id: "v2-overdue-analysis", label: "逾期分析", icon: AlertTriangle, description: "逾期任務明細統計" },
      { id: "v2-overtime-analysis", label: "加班分析 v2", icon: Clock, description: "詳細加班工時分析" },
      { id: "v2-permission-audit", label: "權限稽核", icon: Shield, description: "權限存取事件記錄" },
      { id: "v2-time-efficiency", label: "時間效率", icon: TrendingUp, description: "預估 vs 實際工時效率" },
      { id: "v2-workload-distribution", label: "工作量分佈 v2", icon: Users, description: "詳細工作負荷分析" },
    ],
  },
];

// Flat list for backward compat
export const REPORTS: ReportNav[] = REPORT_CATEGORIES.flatMap((c) => c.reports);

// Reports handled by the original inline components (not delegated to ReportsExtended)
export const ORIGINAL_REPORT_IDS = new Set<ReportId>([
  "utilization", "velocity", "kpi-trend", "unplanned",
  "time-summary", "overtime", "audit-summary", "login-activity",
  "project-status", "project-budget",
]);

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ReportSidebarNavProps {
  activeReport: ReportId;
  onSelect: (id: ReportId) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReportSidebarNav({ activeReport, onSelect }: ReportSidebarNavProps) {
  return (
    <nav
      className="lg:w-60 flex-shrink-0 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 lg:border-r lg:border-border lg:pr-4"
      aria-label="報表導覽"
      data-testid="reports-left-nav"
    >
      <div className="hidden lg:block mb-3">
        <h1 className="text-lg font-semibold tracking-tight">報表</h1>
        <p className="text-xs text-muted-foreground mt-0.5">管理分析與趨勢</p>
      </div>

      {REPORT_CATEGORIES.map((category) => {
        const CatIcon = category.icon;
        return (
          <div key={category.label} className="mb-2">
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <CatIcon className="h-3.5 w-3.5" />
              {category.label}
            </div>
            {category.reports.length === 0 ? (
              <div className="px-3 py-1 text-[10px] text-muted-foreground/60 italic hidden lg:block">
                即將推出
              </div>
            ) : (
              category.reports.map(({ id, label, icon: Icon, description }) => (
                <button
                  key={id}
                  onClick={() => onSelect(id)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors whitespace-nowrap lg:whitespace-normal w-full",
                    activeReport === id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                  aria-current={activeReport === id ? "page" : undefined}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm">{label}</div>
                    <div className="text-[10px] text-muted-foreground hidden lg:block">{description}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        );
      })}
    </nav>
  );
}
