"use client";

/**
 * Audit and project table reports — AuditSummaryReport, LoginActivityReport,
 * ProjectStatusReport, ProjectBudgetReport.
 * Extracted from reports/page.tsx (Issue #1161).
 */

import { useState, useEffect } from "react";
import { Loader2, Download } from "lucide-react";
import { exportCSV } from "./report-charts";

// ─── Types ────────────────────────────────────────────────────────────────────

import type { DateRangeProps } from "./report-types";
export type { DateRangeProps } from "./report-types";

interface AuditEntry {
  id: string;
  timestamp: string;
  user: { name: string; email: string; role: string } | null;
  action: string;
  module: string;
  resourceType: string;
  resourceId: string | null;
  detail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

interface LoginEntry {
  id: string;
  timestamp: string;
  user: { name: string; email: string; role: string } | null;
  action: string;
  detail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

interface BudgetRow {
  id: string;
  code: string;
  name: string;
  budgetTotal: number;
  budgetActual: number;
  executionRate: number;
  status: string;
}

const PROJECT_STATUS_LABELS: Record<string, string> = {
  PROPOSED: "提案", EVALUATING: "評估中", APPROVED: "已核准", SCHEDULED: "已排程",
  REQUIREMENTS: "需求分析", DESIGN: "系統設計", DEVELOPMENT: "開發中", TESTING: "測試中",
  DEPLOYMENT: "部署中", WARRANTY: "保固期", COMPLETED: "已完成", POST_REVIEW: "後評價",
  CLOSED: "已關閉", ON_HOLD: "暫停", CANCELLED: "已取消",
};

// ─── Audit Summary Report ────────────────────────────────────────────────────

export function AuditSummaryReport({ from, to }: DateRangeProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ from, to, mode: "detail", limit: String(pageSize), offset: String(page * pageSize) });
    if (actionFilter) params.set("action", actionFilter);
    fetch(`/api/reports/audit-summary?${params}`)
      .then(r => r.json())
      .then(d => { setEntries(d.data?.entries ?? []); setTotal(d.data?.total ?? 0); })
      .catch(() => { setEntries([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [from, to, actionFilter, page]);

  const handleExport = () => {
    exportCSV(
      ["時間", "操作者", "Email", "角色", "操作", "模組", "資源類型", "資源ID", "詳情", "IP", "User-Agent"],
      entries.map(e => [e.timestamp, e.user?.name ?? "匿名", e.user?.email ?? "-", e.user?.role ?? "-", e.action, e.module, e.resourceType, e.resourceId ?? "-", (e.detail ?? "").replace(/,/g, ";"), e.ipAddress ?? "-", (e.userAgent ?? "").replace(/,/g, ";")]),
      `audit-detail-${from}-${to}.csv`
    );
  };

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">稽核日誌明細</h3>
          <span className="text-xs text-muted-foreground">共 {total} 筆</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={actionFilter}
            onChange={e => { setActionFilter(e.target.value); setPage(0); }}
            placeholder="篩選操作類型..."
            className="text-xs px-2 py-1 border border-border rounded-md w-40 bg-background text-foreground placeholder:text-muted-foreground"
          />
          <button onClick={handleExport} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent">
            <Download className="h-3.5 w-3.5" />CSV
          </button>
        </div>
      </div>
      {loading
        ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        : !entries.length
          ? <div className="text-center text-muted-foreground py-12">此期間無稽核紀錄</div>
          : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-2 px-2 whitespace-nowrap">時間</th>
                      <th className="text-left py-2 px-2">操作者</th>
                      <th className="text-left py-2 px-2">角色</th>
                      <th className="text-left py-2 px-2">操作</th>
                      <th className="text-left py-2 px-2">模組</th>
                      <th className="text-left py-2 px-2">資源</th>
                      <th className="text-left py-2 px-2">IP</th>
                      <th className="text-left py-2 px-2 max-w-[200px]">詳情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(e => (
                      <tr key={e.id} className="border-b border-border/30 hover:bg-accent/30">
                        <td className="py-1.5 px-2 font-mono whitespace-nowrap">{new Date(e.timestamp).toLocaleString("zh-TW")}</td>
                        <td className="py-1.5 px-2">{e.user?.name ?? <span className="text-muted-foreground">匿名</span>}</td>
                        <td className="py-1.5 px-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${e.user?.role === "MANAGER" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                            {e.user?.role ?? "-"}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 font-mono">{e.action}</td>
                        <td className="py-1.5 px-2">{e.module}</td>
                        <td className="py-1.5 px-2 font-mono text-[10px]">{e.resourceType}{e.resourceId ? `:${e.resourceId.slice(0, 8)}` : ""}</td>
                        <td className="py-1.5 px-2 font-mono text-[10px]">{e.ipAddress ?? "-"}</td>
                        <td className="py-1.5 px-2 text-[10px] max-w-[200px] truncate" title={e.detail ?? ""}>{e.detail ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center mt-3 text-xs text-muted-foreground">
                <span>{page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} / {total}</span>
                <div className="flex gap-2">
                  <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-2 py-1 border rounded disabled:opacity-30">上一頁</button>
                  <button disabled={(page + 1) * pageSize >= total} onClick={() => setPage(p => p + 1)} className="px-2 py-1 border rounded disabled:opacity-30">下一頁</button>
                </div>
              </div>
            </>
          )
      }
    </div>
  );
}

// ─── Login Activity Report ────────────────────────────────────────────────────

export function LoginActivityReport({ from, to }: DateRangeProps) {
  const [entries, setEntries] = useState<LoginEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [resultFilter, setResultFilter] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ from, to, mode: "detail", limit: String(pageSize), offset: String(page * pageSize) });
    if (resultFilter) params.set("result", resultFilter);
    fetch(`/api/reports/login-activity?${params}`)
      .then(r => r.json())
      .then(d => { setEntries(d.data?.entries ?? []); setTotal(d.data?.total ?? 0); })
      .catch(() => { setEntries([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [from, to, resultFilter, page]);

  const handleExport = () => {
    exportCSV(
      ["時間", "操作者", "Email", "角色", "事件", "詳情", "IP", "User-Agent"],
      entries.map(e => [e.timestamp, e.user?.name ?? "匿名", e.user?.email ?? "-", e.user?.role ?? "-", e.action, (e.detail ?? "").replace(/,/g, ";"), e.ipAddress ?? "-", (e.userAgent ?? "").replace(/,/g, ";")]),
      `login-activity-${from}-${to}.csv`
    );
  };

  const actionLabel = (a: string) => {
    const m: Record<string, string> = {
      LOGIN_SUCCESS: "登入成功", LOGIN_FAILURE: "登入失敗",
      MOBILE_LOGIN_SUCCESS: "行動登入成功", MOBILE_LOGIN_FAILURE: "行動登入失敗",
      LOGOUT: "登出", MOBILE_LOGOUT: "行動登出", SESSION_TIMEOUT: "Session 逾時",
      ACCOUNT_LOCKED: "帳號鎖定", PASSWORD_CHANGE: "密碼變更",
    };
    return m[a] ?? a;
  };
  const actionColor = (a: string) =>
    a.includes("SUCCESS") ? "text-green-600" :
    a.includes("FAILURE") || a === "ACCOUNT_LOCKED" ? "text-red-600" :
    "text-amber-600";

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">登入活動明細</h3>
          <span className="text-xs text-muted-foreground">共 {total} 筆</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={resultFilter}
            onChange={e => { setResultFilter(e.target.value); setPage(0); }}
            className="text-xs px-2 py-1 border border-border rounded-md bg-background text-foreground"
          >
            <option value="">全部</option>
            <option value="success">成功</option>
            <option value="failure">失敗</option>
          </select>
          <button onClick={handleExport} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent">
            <Download className="h-3.5 w-3.5" />CSV
          </button>
        </div>
      </div>
      {loading
        ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        : !entries.length
          ? <div className="text-center text-muted-foreground py-12">此期間無登入紀錄</div>
          : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-2 px-2 whitespace-nowrap">時間</th>
                      <th className="text-left py-2 px-2">操作者</th>
                      <th className="text-left py-2 px-2">Email</th>
                      <th className="text-left py-2 px-2">事件</th>
                      <th className="text-left py-2 px-2">IP</th>
                      <th className="text-left py-2 px-2 max-w-[200px]">詳情</th>
                      <th className="text-left py-2 px-2 max-w-[150px]">裝置</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(e => (
                      <tr key={e.id} className="border-b border-border/30 hover:bg-accent/30">
                        <td className="py-1.5 px-2 font-mono whitespace-nowrap">{new Date(e.timestamp).toLocaleString("zh-TW")}</td>
                        <td className="py-1.5 px-2">{e.user?.name ?? <span className="text-muted-foreground">匿名</span>}</td>
                        <td className="py-1.5 px-2 text-[10px]">{e.user?.email ?? "-"}</td>
                        <td className={`py-1.5 px-2 font-medium ${actionColor(e.action)}`}>{actionLabel(e.action)}</td>
                        <td className="py-1.5 px-2 font-mono text-[10px]">{e.ipAddress ?? "-"}</td>
                        <td className="py-1.5 px-2 text-[10px] max-w-[200px] truncate" title={e.detail ?? ""}>{e.detail ?? "-"}</td>
                        <td className="py-1.5 px-2 text-[10px] max-w-[150px] truncate" title={e.userAgent ?? ""}>{e.userAgent ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center mt-3 text-xs text-muted-foreground">
                <span>{page * pageSize + 1}-{Math.min((page + 1) * pageSize, total)} / {total}</span>
                <div className="flex gap-2">
                  <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-2 py-1 border rounded disabled:opacity-30">上一頁</button>
                  <button disabled={(page + 1) * pageSize >= total} onClick={() => setPage(p => p + 1)} className="px-2 py-1 border rounded disabled:opacity-30">下一頁</button>
                </div>
              </div>
            </>
          )
      }
    </div>
  );
}

// ─── Project Status Distribution Report ─────────────────────────────────────

export function ProjectStatusReport() {
  const [data, setData] = useState<{ status: string; count: number }[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/project-status?year=${reportYear}`)
      .then(r => r.json())
      .then(d => { setData(d.data?.byStatus ?? []); setTotal(d.data?.total ?? 0); })
      .catch(() => { setData([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [reportYear]);

  const handleExport = () => exportCSV(
    ["狀態", "數量"],
    data.map(r => [PROJECT_STATUS_LABELS[r.status] ?? r.status, String(r.count)]),
    `project-status-${reportYear}.csv`
  );

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const maxCount = Math.max(1, ...data.map(d => d.count));

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <div>
          <h3 className="font-semibold">項目狀態分佈</h3>
          <p className="text-xs text-muted-foreground">共 {total} 個項目</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={reportYear}
            onChange={e => setReportYear(parseInt(e.target.value) || new Date().getFullYear())}
            className="text-sm px-2 py-1 border border-border rounded-md w-20 bg-background text-foreground"
          />
          <button onClick={handleExport} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent">
            <Download className="h-3.5 w-3.5" />CSV
          </button>
        </div>
      </div>
      {data.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">此年度無項目資料</div>
      ) : (
        <div className="space-y-2">
          {data.map(r => (
            <div key={r.status} className="flex items-center gap-3">
              <span className="text-xs w-20 flex-shrink-0 text-right text-muted-foreground">{PROJECT_STATUS_LABELS[r.status] ?? r.status}</span>
              <div className="flex-1 h-6 bg-muted/30 rounded overflow-hidden">
                <div className="h-full bg-primary/60 rounded transition-all" style={{ width: `${(r.count / maxCount) * 100}%` }} />
              </div>
              <span className="text-sm font-medium tabular-nums w-10">{r.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Project Budget Execution Report ─────────────────────────────────────────

export function ProjectBudgetReport() {
  const [data, setData] = useState<BudgetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/project-budget?year=${reportYear}`)
      .then(r => r.json())
      .then(d => setData(d.data?.items ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [reportYear]);

  const handleExport = () => exportCSV(
    ["編號", "名稱", "預算", "實際花費", "執行率(%)", "狀態"],
    data.map(r => [r.code, r.name, String(r.budgetTotal), String(r.budgetActual), String(r.executionRate), PROJECT_STATUS_LABELS[r.status] ?? r.status]),
    `project-budget-${reportYear}.csv`
  );

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <div>
          <h3 className="font-semibold">預算執行率</h3>
          <p className="text-xs text-muted-foreground">各項目預算 vs 實際花費</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={reportYear}
            onChange={e => setReportYear(parseInt(e.target.value) || new Date().getFullYear())}
            className="text-sm px-2 py-1 border border-border rounded-md w-20 bg-background text-foreground"
          />
          <button onClick={handleExport} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent">
            <Download className="h-3.5 w-3.5" />CSV
          </button>
        </div>
      </div>
      {data.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">此年度無項目資料</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-2 px-2">編號</th>
                <th className="text-left py-2 px-2">名稱</th>
                <th className="text-right py-2 px-2">預算</th>
                <th className="text-right py-2 px-2">實際花費</th>
                <th className="text-right py-2 px-2">執行率</th>
                <th className="text-left py-2 px-2">狀態</th>
              </tr>
            </thead>
            <tbody>
              {data.map(r => {
                const rateColor = r.executionRate > 100 ? "text-red-600" : r.executionRate >= 80 ? "text-amber-600" : "text-foreground";
                return (
                  <tr key={r.id} className="border-b border-border/30 hover:bg-accent/30">
                    <td className="py-1.5 px-2 font-mono">{r.code}</td>
                    <td className="py-1.5 px-2">{r.name}</td>
                    <td className="text-right py-1.5 px-2 tabular-nums">{r.budgetTotal.toLocaleString()}</td>
                    <td className="text-right py-1.5 px-2 tabular-nums">{r.budgetActual.toLocaleString()}</td>
                    <td className={`text-right py-1.5 px-2 font-bold tabular-nums ${rateColor}`}>{r.executionRate}%</td>
                    <td className="py-1.5 px-2">{PROJECT_STATUS_LABELS[r.status] ?? r.status}</td>
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
