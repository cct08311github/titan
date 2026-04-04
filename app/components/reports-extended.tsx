"use client";

/**
 * ReportsExtended — renders the additional reports not covered by the main reports page.
 * Issue: T1272 (feat/T1272-remaining-api-ui)
 *
 * Accepts activeReport, from, to, year props and delegates to the appropriate
 * sub-report component. Uses GenericReportTable for simple tabular rendering.
 */

import { useState, useEffect, useCallback } from "react";
import { Loader2, Download, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ReportsExtendedProps {
  activeReport: string;
  from: string;
  to: string;
  year: number;
}

// ─── Generic table helper ─────────────────────────────────────────────────────

interface GenericReportTableProps {
  headers: string[];
  rows: (string | number)[][];
}

function GenericReportTable({ headers, rows }: GenericReportTableProps) {
  if (rows.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12 text-sm">
        此期間無資料
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-2 font-medium text-muted-foreground whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/30 hover:bg-accent/30 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2 whitespace-nowrap tabular-nums">
                  {String(cell ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Shared fetch hook ────────────────────────────────────────────────────────

function useReportData<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      setData(extractData<T>(body));
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}

// ─── Loading / Error wrappers ─────────────────────────────────────────────────

function ReportLoading({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">{message ?? "載入中..."}</span>
    </div>
  );
}

function ReportError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-destructive">
      <AlertCircle className="h-6 w-6" />
      <span className="text-sm">{message}</span>
      <button
        onClick={onRetry}
        className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent transition-colors"
      >
        重試
      </button>
    </div>
  );
}

// ─── Report title helper ──────────────────────────────────────────────────────

function ReportHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Utility: flatten object to header/row ────────────────────────────────────

function flattenToTable(items: Record<string, unknown>[]): { headers: string[]; rows: (string | number)[][] } {
  if (!items || items.length === 0) return { headers: [], rows: [] };
  const headers = Object.keys(items[0]);
  const rows = items.map((item) => headers.map((h) => {
    const v = item[h];
    if (v === null || v === undefined) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return v as string | number;
  }));
  return { headers, rows };
}

// ─── Completion Rate ──────────────────────────────────────────────────────────

function CompletionRateReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/completion-rate?granularity=month&from=${from}&to=${to}`;
  const { data, loading, error, reload } = useReportData<{
    points?: { month: string; total: number; completed: number; rate: number }[];
    summary?: { totalTasks: number; completedTasks: number; averageRate: number };
  }>(url);

  if (loading) return <ReportLoading message="載入完成率..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const points = data?.points ?? [];
  const summary = data?.summary;

  return (
    <div>
      <ReportHeader title="任務完成率趨勢" description="每月任務完成比率">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>總任務 <strong className="text-foreground">{summary.totalTasks}</strong></span>
            <span>已完成 <strong className="text-foreground">{summary.completedTasks}</strong></span>
            <span>平均完成率 <strong className="text-foreground">{summary.averageRate}%</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["月份", "總任務", "已完成", "完成率(%)"]}
        rows={points.map((p) => [p.month, p.total, p.completed, p.rate])}
      />
    </div>
  );
}

// ─── Custom Report ────────────────────────────────────────────────────────────

function CustomReport({ from, to }: { from: string; to: string }) {
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [page] = useState(1);
  const url = `/api/reports/custom?category=${encodeURIComponent(category)}&status=${encodeURIComponent(status)}&from=${from}&to=${to}&page=${page}&limit=20`;
  const { data, loading, error, reload } = useReportData<{
    items?: Record<string, unknown>[];
    total?: number;
    page?: number;
    limit?: number;
  }>(url);

  const items = data?.items ?? [];
  const { headers, rows } = flattenToTable(items);

  return (
    <div>
      <ReportHeader title="自訂查詢" description="按類別和狀態過濾任務">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="類別"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={cn(
              "text-sm px-2 py-1 border border-border rounded-md bg-background w-24",
              "focus:outline-none focus:ring-1 focus:ring-ring"
            )}
          />
          <input
            type="text"
            placeholder="狀態"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={cn(
              "text-sm px-2 py-1 border border-border rounded-md bg-background w-24",
              "focus:outline-none focus:ring-1 focus:ring-ring"
            )}
          />
          <button
            onClick={reload}
            className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent transition-colors"
          >
            查詢
          </button>
        </div>
      </ReportHeader>
      {loading ? (
        <ReportLoading message="查詢中..." />
      ) : error ? (
        <ReportError message={error} onRetry={reload} />
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-2">共 {data?.total ?? 0} 筆</p>
          <GenericReportTable headers={headers} rows={rows} />
        </>
      )}
    </div>
  );
}

// ─── Delay Change ─────────────────────────────────────────────────────────────

function DelayChangeReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/delay-change?from=${from}&to=${to}`;
  const { data, loading, error, reload } = useReportData<{
    items?: { taskId: string; title: string; originalDue: string; newDue: string; delayDays: number; reason?: string }[];
    summary?: { totalDelayed: number; avgDelayDays: number };
  }>(url);

  if (loading) return <ReportLoading message="載入延遲分析..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const items = data?.items ?? [];
  const summary = data?.summary;

  return (
    <div>
      <ReportHeader title="延遲變化分析" description="此期間發生延遲的任務明細">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>延遲任務 <strong className="text-foreground">{summary.totalDelayed}</strong></span>
            <span>平均延遲 <strong className="text-foreground">{summary.avgDelayDays} 天</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["任務 ID", "標題", "原截止", "新截止", "延遲天數", "原因"]}
        rows={items.map((i) => [i.taskId, i.title, i.originalDue, i.newDue, i.delayDays, i.reason ?? ""])}
      />
    </div>
  );
}

// ─── Department Timesheet ─────────────────────────────────────────────────────

function DepartmentTimesheetReport({ from }: { from: string }) {
  // Use the from date as weekStart
  const weekStart = from;
  const url = `/api/reports/department-timesheet?weekStart=${weekStart}`;
  const { data, loading, error, reload } = useReportData<{
    departments?: { department: string; members: number; totalHours: number; avgHours: number }[];
    weekStart?: string;
    weekEnd?: string;
  }>(url);

  if (loading) return <ReportLoading message="載入部門工時表..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const depts = data?.departments ?? [];

  return (
    <div>
      <ReportHeader title="部門工時表" description={`週次：${data?.weekStart ?? weekStart} ~ ${data?.weekEnd ?? ""}`} />
      <GenericReportTable
        headers={["部門", "成員人數", "總工時(h)", "平均工時(h)"]}
        rows={depts.map((d) => [d.department, d.members, d.totalHours, d.avgHours])}
      />
    </div>
  );
}

// ─── KPI Report ───────────────────────────────────────────────────────────────

function KpiReport({ year }: { year: number }) {
  const url = `/api/reports/kpi?year=${year}`;
  const { data, loading, error, reload } = useReportData<{
    items?: { kpiId: string; title: string; category: string; target: number; actual: number; achievement: number; unit: string }[];
    year?: number;
    summary?: { total: number; achieved: number; achievementRate: number };
  }>(url);

  if (loading) return <ReportLoading message="載入 KPI 報表..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const items = data?.items ?? [];
  const summary = data?.summary;

  return (
    <div>
      <ReportHeader title={`KPI 報表 ${year}`} description="年度 KPI 達成概況">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>總項目 <strong className="text-foreground">{summary.total}</strong></span>
            <span>已達成 <strong className="text-foreground">{summary.achieved}</strong></span>
            <span>達成率 <strong className="text-foreground">{summary.achievementRate}%</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["KPI ID", "標題", "類別", "目標", "實際", "達成率(%)", "單位"]}
        rows={items.map((i) => [i.kpiId, i.title, i.category, i.target, i.actual, i.achievement, i.unit])}
      />
    </div>
  );
}

// ─── Monthly Report ───────────────────────────────────────────────────────────

function MonthlyReport({ from }: { from: string }) {
  // Derive YYYY-MM from the from date
  const month = from.substring(0, 7);
  const url = `/api/reports/monthly?month=${month}`;
  const { data, loading, error, reload } = useReportData<{
    month?: string;
    summary?: Record<string, unknown>;
    tasks?: Record<string, unknown>[];
    timesheets?: Record<string, unknown>[];
  }>(url);

  if (loading) return <ReportLoading message="載入月報..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const tasks = (data?.tasks ?? []) as Record<string, unknown>[];
  const { headers, rows } = flattenToTable(tasks);

  return (
    <div>
      <ReportHeader title={`月報 ${month}`} description="月度工作摘要" />
      {data?.summary && (
        <div className="mb-4 p-3 rounded-lg bg-muted/50 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(data.summary).map(([k, v]) => (
            <div key={k}>
              <div className="text-muted-foreground">{k}</div>
              <div className="font-medium">{String(v ?? "")}</div>
            </div>
          ))}
        </div>
      )}
      {headers.length > 0 && <GenericReportTable headers={headers} rows={rows} />}
    </div>
  );
}

// ─── Time Distribution ────────────────────────────────────────────────────────

function TimeDistributionReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/time-distribution?from=${from}&to=${to}`;
  const { data, loading, error, reload } = useReportData<{
    users?: string[];
    series?: Record<string, number[]>;
    from?: string;
    to?: string;
  }>(url);

  if (loading) return <ReportLoading message="載入工時分佈..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const users = data?.users ?? [];
  const series = data?.series ?? {};
  const categories = Object.keys(series);

  return (
    <div>
      <ReportHeader title="工時分佈" description={`${from} ~ ${to} 各類工時分佈`} />
      {users.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 text-sm">此期間無工時資料</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">成員</th>
                {categories.map((c) => (
                  <th key={c} className="text-right px-4 py-2 font-medium text-muted-foreground whitespace-nowrap">{c}</th>
                ))}
                <th className="text-right px-4 py-2 font-medium text-muted-foreground">合計</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => {
                const vals = categories.map((c) => series[c]?.[idx] ?? 0);
                const total = vals.reduce((s, v) => s + v, 0);
                return (
                  <tr key={user} className="border-b border-border/30 hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-2">{user}</td>
                    {vals.map((v, j) => (
                      <td key={j} className="text-right px-4 py-2 tabular-nums">{v}</td>
                    ))}
                    <td className="text-right px-4 py-2 tabular-nums font-medium">{Math.round(total * 10) / 10}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Timesheet Compliance ─────────────────────────────────────────────────────

function TimesheetComplianceReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/timesheet-compliance?startDate=${from}&endDate=${to}`;
  const { data, loading, error, reload } = useReportData<{
    items?: { userId: string; userName: string; submittedWeeks: number; totalWeeks: number; complianceRate: number }[];
    summary?: { avgComplianceRate: number; fullyCompliant: number; total: number };
  }>(url);

  if (loading) return <ReportLoading message="載入工時合規..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const items = data?.items ?? [];
  const summary = data?.summary;

  return (
    <div>
      <ReportHeader title="工時合規報表" description="工時填報合規統計">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>完全合規 <strong className="text-foreground">{summary.fullyCompliant}/{summary.total}</strong></span>
            <span>平均合規率 <strong className="text-foreground">{summary.avgComplianceRate}%</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["員工 ID", "姓名", "已提交週數", "總週數", "合規率(%)"]}
        rows={items.map((i) => [i.userId, i.userName, i.submittedWeeks, i.totalWeeks, i.complianceRate])}
      />
    </div>
  );
}

// ─── Trends ───────────────────────────────────────────────────────────────────

function TrendsReport({ year }: { year: number }) {
  const years = `${year - 1},${year}`;
  const url = `/api/reports/trends?metric=kpi&years=${years}`;
  const { data, loading, error, reload } = useReportData<{
    metric?: string;
    years?: number[];
    points?: { period: string; value: number; year: number }[];
  }>(url);

  if (loading) return <ReportLoading message="載入跨年趨勢..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const points = data?.points ?? [];

  return (
    <div>
      <ReportHeader title="跨年趨勢" description={`KPI 跨年度對比：${years}`} />
      <GenericReportTable
        headers={["期間", "年度", "數值"]}
        rows={points.map((p) => [p.period, p.year, p.value])}
      />
    </div>
  );
}

// ─── Weekly Report ────────────────────────────────────────────────────────────

function WeeklyReport({ from }: { from: string }) {
  const weekStart = from;
  const url = `/api/reports/weekly?weekStart=${weekStart}`;
  const { data, loading, error, reload } = useReportData<{
    weekStart?: string;
    weekEnd?: string;
    summary?: Record<string, unknown>;
    tasks?: Record<string, unknown>[];
  }>(url);

  if (loading) return <ReportLoading message="載入週報..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const tasks = (data?.tasks ?? []) as Record<string, unknown>[];
  const { headers, rows } = flattenToTable(tasks);

  return (
    <div>
      <ReportHeader title="週報" description={`週次：${data?.weekStart ?? weekStart} ~ ${data?.weekEnd ?? ""}`} />
      {data?.summary && (
        <div className="mb-4 p-3 rounded-lg bg-muted/50 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(data.summary).map(([k, v]) => (
            <div key={k}>
              <div className="text-muted-foreground">{k}</div>
              <div className="font-medium">{String(v ?? "")}</div>
            </div>
          ))}
        </div>
      )}
      {headers.length > 0 && <GenericReportTable headers={headers} rows={rows} />}
    </div>
  );
}

// ─── Workload ─────────────────────────────────────────────────────────────────

function WorkloadReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/workload?from=${from}&to=${to}`;
  const { data, loading, error, reload } = useReportData<{
    items?: { userId: string; userName: string; assignedTasks: number; completedTasks: number; pendingTasks: number; overdueTasks: number }[];
    summary?: { totalAssigned: number; totalCompleted: number };
  }>(url);

  if (loading) return <ReportLoading message="載入工作量分析..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const items = data?.items ?? [];
  const summary = data?.summary;

  return (
    <div>
      <ReportHeader title="工作量分析" description="個人任務負荷分佈">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>總指派 <strong className="text-foreground">{summary.totalAssigned}</strong></span>
            <span>已完成 <strong className="text-foreground">{summary.totalCompleted}</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["員工 ID", "姓名", "指派任務", "已完成", "待處理", "逾期"]}
        rows={items.map((i) => [i.userId, i.userName, i.assignedTasks, i.completedTasks, i.pendingTasks, i.overdueTasks])}
      />
    </div>
  );
}

// ─── V2 Change Summary ────────────────────────────────────────────────────────

function V2ChangeSummaryReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/v2/change-summary?startDate=${from}&endDate=${to}`;
  const { data, loading, error, reload } = useReportData<{
    data?: { items?: Record<string, unknown>[]; summary?: Record<string, unknown> };
    meta?: { total?: number };
  }>(url);

  if (loading) return <ReportLoading message="載入變更摘要..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const items = (data?.data?.items ?? []) as Record<string, unknown>[];
  const { headers, rows } = flattenToTable(items);

  return (
    <div>
      <ReportHeader title="變更摘要" description="此期間的任務/計畫變更記錄">
        {data?.meta?.total !== undefined && (
          <span className="text-xs text-muted-foreground">共 {data.meta.total} 筆</span>
        )}
      </ReportHeader>
      <GenericReportTable headers={headers} rows={rows} />
    </div>
  );
}

// ─── V2 Earned Value ─────────────────────────────────────────────────────────

function V2EarnedValueReport({ from }: { from: string }) {
  const [planId, setPlanId] = useState("");
  const url = `/api/reports/v2/earned-value?asOfDate=${from}${planId ? `&planId=${encodeURIComponent(planId)}` : ""}`;
  const { data, loading, error, reload } = useReportData<{
    data?: {
      planId?: string;
      planTitle?: string;
      asOfDate?: string;
      pv?: number;
      ev?: number;
      ac?: number;
      spi?: number;
      cpi?: number;
      items?: Record<string, unknown>[];
    };
  }>(url);

  const ev = data?.data;
  const items = (ev?.items ?? []) as Record<string, unknown>[];
  const { headers, rows } = flattenToTable(items);

  return (
    <div>
      <ReportHeader title="實獲值分析 (EVM)" description="Earned Value Management 指標">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="計畫 ID"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className={cn(
              "text-sm px-2 py-1 border border-border rounded-md bg-background w-28",
              "focus:outline-none focus:ring-1 focus:ring-ring"
            )}
          />
          <button onClick={reload} className="text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent transition-colors">
            查詢
          </button>
        </div>
      </ReportHeader>
      {loading ? (
        <ReportLoading message="載入實獲值分析..." />
      ) : error ? (
        <ReportError message={error} onRetry={reload} />
      ) : (
        <>
          {ev && (
            <div className="mb-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: "PV (計畫價值)", value: ev.pv },
                { label: "EV (實獲值)", value: ev.ev },
                { label: "AC (實際成本)", value: ev.ac },
                { label: "SPI (進度績效)", value: ev.spi },
                { label: "CPI (成本績效)", value: ev.cpi },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 rounded-lg bg-muted/50 text-center">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-lg font-semibold mt-1">{value !== undefined ? value : "—"}</div>
                </div>
              ))}
            </div>
          )}
          {headers.length > 0 && <GenericReportTable headers={headers} rows={rows} />}
        </>
      )}
    </div>
  );
}

// ─── V2 Incident SLA ─────────────────────────────────────────────────────────

function V2IncidentSlaReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/v2/incident-sla?startDate=${from}&endDate=${to}`;
  const { data, loading, error, reload } = useReportData<{
    data?: {
      items?: { incidentId: string; title: string; priority: string; openedAt: string; resolvedAt?: string; slaTarget: number; actualHours: number; slaMet: boolean }[];
      summary?: { total: number; slaMet: number; slaBreached: number; slaRate: number };
    };
    meta?: { total?: number };
  }>(url);

  if (loading) return <ReportLoading message="載入事件 SLA..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const d = data?.data;
  const items = d?.items ?? [];
  const summary = d?.summary;

  return (
    <div>
      <ReportHeader title="事件 SLA 報表" description="事件處理時效達標率">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>總事件 <strong className="text-foreground">{summary.total}</strong></span>
            <span>SLA 達標 <strong className="text-foreground">{summary.slaMet}</strong></span>
            <span>達標率 <strong className="text-foreground">{summary.slaRate}%</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["事件 ID", "標題", "優先級", "開立時間", "解決時間", "SLA(h)", "實際(h)", "達標"]}
        rows={items.map((i) => [
          i.incidentId,
          i.title,
          i.priority,
          i.openedAt,
          i.resolvedAt ?? "未解決",
          i.slaTarget,
          i.actualHours,
          i.slaMet ? "✓" : "✗",
        ])}
      />
    </div>
  );
}

// ─── V2 KPI Composite ────────────────────────────────────────────────────────

function V2KpiCompositeReport({ year }: { year: number }) {
  const url = `/api/reports/v2/kpi-composite?year=${year}`;
  const { data, loading, error, reload } = useReportData<{
    data?: {
      year?: number;
      categories?: { category: string; kpiCount: number; avgAchievement: number; topKpi?: string }[];
      overall?: { achievementRate: number; trend: string };
    };
  }>(url);

  if (loading) return <ReportLoading message="載入 KPI 綜合..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const d = data?.data;
  const categories = d?.categories ?? [];
  const overall = d?.overall;

  return (
    <div>
      <ReportHeader title={`KPI 綜合報表 ${year}`} description="各類別 KPI 達成率綜合統計">
        {overall && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>整體達成率 <strong className="text-foreground">{overall.achievementRate}%</strong></span>
            <span>趨勢 <strong className="text-foreground">{overall.trend}</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["類別", "KPI 數", "平均達成(%)", "最佳 KPI"]}
        rows={categories.map((c) => [c.category, c.kpiCount, c.avgAchievement, c.topKpi ?? ""])}
      />
    </div>
  );
}

// ─── V2 KPI Correlation ──────────────────────────────────────────────────────

function V2KpiCorrelationReport({ year }: { year: number }) {
  const url = `/api/reports/v2/kpi-correlation?year=${year}`;
  const { data, loading, error, reload } = useReportData<{
    data?: {
      year?: number;
      pairs?: { kpi1: string; kpi2: string; correlation: number; strength: string }[];
    };
  }>(url);

  if (loading) return <ReportLoading message="載入 KPI 相關性..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const pairs = data?.data?.pairs ?? [];

  return (
    <div>
      <ReportHeader title={`KPI 相關性分析 ${year}`} description="KPI 指標間的相關係數" />
      <GenericReportTable
        headers={["KPI 1", "KPI 2", "相關係數", "強度"]}
        rows={pairs.map((p) => [p.kpi1, p.kpi2, p.correlation, p.strength])}
      />
    </div>
  );
}

// ─── V2 Milestone Achievement ─────────────────────────────────────────────────

function V2MilestoneAchievementReport({ year }: { year: number }) {
  const url = `/api/reports/v2/milestone-achievement?year=${year}`;
  const { data, loading, error, reload } = useReportData<{
    data?: {
      items?: { milestoneId: string; title: string; planTitle: string; dueDate: string; status: string; achievedDate?: string; onTime: boolean }[];
      summary?: { total: number; achieved: number; onTime: number; achievementRate: number };
    };
  }>(url);

  if (loading) return <ReportLoading message="載入里程碑達成..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const d = data?.data;
  const items = d?.items ?? [];
  const summary = d?.summary;

  return (
    <div>
      <ReportHeader title={`里程碑達成報表 ${year}`} description="里程碑按時完成情況">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>總里程碑 <strong className="text-foreground">{summary.total}</strong></span>
            <span>已達成 <strong className="text-foreground">{summary.achieved}</strong></span>
            <span>準時率 <strong className="text-foreground">{summary.onTime}/{summary.achieved}</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["ID", "標題", "所屬計畫", "截止日", "狀態", "完成日", "準時"]}
        rows={items.map((i) => [
          i.milestoneId,
          i.title,
          i.planTitle,
          i.dueDate,
          i.status,
          i.achievedDate ?? "—",
          i.onTime ? "✓" : "✗",
        ])}
      />
    </div>
  );
}

// ─── V2 Overdue Analysis ─────────────────────────────────────────────────────

function V2OverdueAnalysisReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/v2/overdue-analysis?startDate=${from}&endDate=${to}`;
  const { data, loading, error, reload } = useReportData<{
    data?: {
      items?: { taskId: string; title: string; assignee: string; dueDate: string; overdueDays: number; status: string }[];
      summary?: { total: number; avgOverdueDays: number; severityBreakdown?: Record<string, number> };
    };
    meta?: { total?: number };
  }>(url);

  if (loading) return <ReportLoading message="載入逾期分析..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const d = data?.data;
  const items = d?.items ?? [];
  const summary = d?.summary;

  return (
    <div>
      <ReportHeader title="逾期分析" description="逾期任務明細與統計">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>逾期任務 <strong className="text-foreground">{summary.total}</strong></span>
            <span>平均逾期 <strong className="text-foreground">{summary.avgOverdueDays} 天</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["任務 ID", "標題", "負責人", "截止日", "逾期天數", "狀態"]}
        rows={items.map((i) => [i.taskId, i.title, i.assignee, i.dueDate, i.overdueDays, i.status])}
      />
    </div>
  );
}

// ─── V2 Overtime Analysis ─────────────────────────────────────────────────────

function V2OvertimeAnalysisReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/v2/overtime-analysis?startDate=${from}&endDate=${to}`;
  const { data, loading, error, reload } = useReportData<{
    data?: {
      items?: { userId: string; userName: string; regularHours: number; overtimeHours: number; holidayHours: number; total: number }[];
      summary?: { totalOvertime: number; avgOvertimePerPerson: number };
    };
  }>(url);

  if (loading) return <ReportLoading message="載入加班分析 v2..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const d = data?.data;
  const items = d?.items ?? [];
  const summary = d?.summary;

  return (
    <div>
      <ReportHeader title="加班分析 v2" description="詳細加班工時分析">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>總加班時數 <strong className="text-foreground">{summary.totalOvertime}h</strong></span>
            <span>人均加班 <strong className="text-foreground">{summary.avgOvertimePerPerson}h</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["員工 ID", "姓名", "正常工時(h)", "加班工時(h)", "假日工時(h)", "合計(h)"]}
        rows={items.map((i) => [i.userId, i.userName, i.regularHours, i.overtimeHours, i.holidayHours, i.total])}
      />
    </div>
  );
}

// ─── V2 Permission Audit ──────────────────────────────────────────────────────

function V2PermissionAuditReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/v2/permission-audit?startDate=${from}&endDate=${to}`;
  const { data, loading, error, reload } = useReportData<{
    data?: {
      items?: { userId: string; userName: string; role: string; action: string; resource: string; timestamp: string; result: string }[];
      summary?: { totalEvents: number; deniedCount: number; uniqueUsers: number };
    };
    meta?: { total?: number };
  }>(url);

  if (loading) return <ReportLoading message="載入權限稽核..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const d = data?.data;
  const items = d?.items ?? [];
  const summary = d?.summary;

  return (
    <div>
      <ReportHeader title="權限稽核報表" description="權限存取事件記錄">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>總事件 <strong className="text-foreground">{summary.totalEvents}</strong></span>
            <span>拒絕次數 <strong className="text-foreground">{summary.deniedCount}</strong></span>
            <span>涉及用戶 <strong className="text-foreground">{summary.uniqueUsers}</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["用戶 ID", "姓名", "角色", "操作", "資源", "時間", "結果"]}
        rows={items.map((i) => [i.userId, i.userName, i.role, i.action, i.resource, i.timestamp, i.result])}
      />
    </div>
  );
}

// ─── V2 Time Efficiency ───────────────────────────────────────────────────────

function V2TimeEfficiencyReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/v2/time-efficiency?startDate=${from}&endDate=${to}`;
  const { data, loading, error, reload } = useReportData<{
    data?: {
      items?: { userId: string; userName: string; estimatedHours: number; actualHours: number; efficiency: number; completedTasks: number }[];
      summary?: { avgEfficiency: number; totalEstimated: number; totalActual: number };
    };
  }>(url);

  if (loading) return <ReportLoading message="載入時間效率..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const d = data?.data;
  const items = d?.items ?? [];
  const summary = d?.summary;

  return (
    <div>
      <ReportHeader title="時間效率分析" description="預估 vs 實際工時效率">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>平均效率 <strong className="text-foreground">{summary.avgEfficiency}%</strong></span>
            <span>預估總計 <strong className="text-foreground">{summary.totalEstimated}h</strong></span>
            <span>實際總計 <strong className="text-foreground">{summary.totalActual}h</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["員工 ID", "姓名", "預估工時(h)", "實際工時(h)", "效率(%)", "完成任務"]}
        rows={items.map((i) => [i.userId, i.userName, i.estimatedHours, i.actualHours, i.efficiency, i.completedTasks])}
      />
    </div>
  );
}

// ─── V2 Workload Distribution ─────────────────────────────────────────────────

function V2WorkloadDistributionReport({ from, to }: { from: string; to: string }) {
  const url = `/api/reports/v2/workload-distribution?startDate=${from}&endDate=${to}`;
  const { data, loading, error, reload } = useReportData<{
    data?: {
      items?: { userId: string; userName: string; department: string; taskCount: number; hoursBurden: number; score: number; level: string }[];
      summary?: { avgScore: number; overloadedCount: number; underloadedCount: number };
    };
  }>(url);

  if (loading) return <ReportLoading message="載入工作量分佈 v2..." />;
  if (error) return <ReportError message={error} onRetry={reload} />;

  const d = data?.data;
  const items = d?.items ?? [];
  const summary = d?.summary;

  return (
    <div>
      <ReportHeader title="工作量分佈 v2" description="詳細工作負荷分析">
        {summary && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>平均負荷分數 <strong className="text-foreground">{summary.avgScore}</strong></span>
            <span>過載人數 <strong className="text-foreground">{summary.overloadedCount}</strong></span>
            <span>低負荷人數 <strong className="text-foreground">{summary.underloadedCount}</strong></span>
          </div>
        )}
      </ReportHeader>
      <GenericReportTable
        headers={["員工 ID", "姓名", "部門", "任務數", "工時負擔(h)", "負荷分數", "負荷等級"]}
        rows={items.map((i) => [i.userId, i.userName, i.department, i.taskCount, i.hoursBurden, i.score, i.level])}
      />
    </div>
  );
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
