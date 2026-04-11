"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, ChevronLeft, ChevronRight, RefreshCw, Clock, Filter } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { extractItems } from "@/lib/api-client";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";

// ── Types ──────────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  detail: string | null;
  ipAddress: string | null;
  createdAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const ACTION_LABELS: Record<string, string> = {
  CREATE: "建立",
  UPDATE: "更新",
  DELETE: "刪除",
  LOGIN: "登入",
  LOGOUT: "登出",
  EXPORT: "匯出",
  IMPORT: "匯入",
  PASSWORD_CHANGE: "變更密碼",
};

const uniqueActions = Object.keys(ACTION_LABELS).sort();

// ── Component ──────────────────────────────────────────────────────────────

export function AuditLogSection() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async (requestedPage = 0) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(requestedPage * PAGE_SIZE),
      });
      if (actionFilter) params.set("action", actionFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const res = await fetch(`/api/audit?${params.toString()}`);
      if (!res.ok) throw new Error("稽核日誌載入失敗");
      const body = await res.json();
      setLogs(extractItems<AuditLogEntry>(body));
      setTotal(body?.data?.total ?? body?.total ?? extractItems<AuditLogEntry>(body).length);
      setPage(requestedPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [actionFilter, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (loading) return <PageLoading message="載入稽核日誌..." className="py-8" />;
  if (error) return <PageError message={error} onRetry={() => load(0)} className="py-8" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          稽核日誌
        </h2>
        <button
          onClick={() => load()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-card hover:bg-accent text-foreground rounded-lg border border-border shadow-sm transition-all"
        >
          <RefreshCw className="h-3 w-3" />
          重新整理
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <Filter className="h-3 w-3" /> 操作類型
          </label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">全部</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABELS[a] ?? a}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> 起始日期
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); }}
            className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> 結束日期
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); }}
            className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {(actionFilter || dateFrom || dateTo) && (
          <button
            onClick={() => { setActionFilter(""); setDateFrom(""); setDateTo(""); }}
            className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            清除篩選
          </button>
        )}
      </div>

      {/* Table */}
      {logs.length === 0 ? (
        <PageEmpty
          icon={<Shield className="h-6 w-6" />}
          title="尚無稽核紀錄"
          description="系統操作（登入、資料變更、匯出等）將自動記錄在此"
          className="py-12"
        />
      ) : (
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-accent/30">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">時間</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">操作</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">資源類型</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">資源 ID</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">詳情</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-2 text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        log.action === "DELETE" ? "text-danger bg-danger/10" :
                        log.action === "CREATE" ? "text-success bg-success/10" :
                        log.action === "LOGIN" ? "text-blue-500 bg-blue-500/10" :
                        "text-foreground bg-accent"
                      )}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">{log.resourceType}</td>
                    <td className="px-4 py-2 text-xs font-mono text-muted-foreground truncate max-w-[120px]">
                      {log.resourceId ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-[200px]">
                      {log.detail ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs font-mono text-muted-foreground">
                      {log.ipAddress ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              共 {total} 筆，第 {page + 1} / {totalPages} 頁
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0 || loading}
                onClick={() => load(page - 1)}
                className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= totalPages - 1 || loading}
                onClick={() => load(page + 1)}
                className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
