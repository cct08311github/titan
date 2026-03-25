"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import {
  Database,
  Shield,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  HardDrive,
  Clock,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";

// ── Types ──────────────────────────────────────────────────────────────────

interface BackupInfo {
  name: string;
  date: string;
  sizeMB: number;
}

interface BackupStatus {
  backupRoot: string;
  lastBackupTime: string | null;
  backupCount: number;
  totalSizeMB: number;
  recentBackups: BackupInfo[];
  lastLogLines: string[];
}

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

// ── Backup Status Section ──────────────────────────────────────────────────

function BackupStatusSection() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/backup-status");
      if (!res.ok) throw new Error("備份狀態載入失敗");
      const json = await res.json();
      setStatus(json.data ?? json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageLoading message="載入備份狀態..." className="py-8" />;
  if (error) return <PageError message={error} onRetry={load} className="py-8" />;
  if (!status) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          備份狀態
        </h2>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-card hover:bg-accent text-foreground rounded-lg border border-border shadow-sm transition-all"
        >
          <RefreshCw className="h-3 w-3" />
          重新整理
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl shadow-card p-4">
          <p className="text-xs text-muted-foreground">最後備份時間</p>
          <p className="text-sm font-semibold mt-1">
            {status.lastBackupTime ?? "尚無備份"}
          </p>
        </div>
        <div className="bg-card rounded-xl shadow-card p-4">
          <p className="text-xs text-muted-foreground">備份總數</p>
          <p className="text-sm font-semibold mt-1">{status.backupCount}</p>
        </div>
        <div className="bg-card rounded-xl shadow-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <HardDrive className="h-3 w-3" /> 總容量
          </p>
          <p className="text-sm font-semibold mt-1">{status.totalSizeMB} MB</p>
        </div>
        <div className="bg-card rounded-xl shadow-card p-4">
          <p className="text-xs text-muted-foreground">備份路徑</p>
          <p className="text-xs font-mono mt-1 truncate">{status.backupRoot}</p>
        </div>
      </div>

      {/* Recent backups table */}
      {status.recentBackups.length > 0 ? (
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium">最近備份</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-accent/30">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">名稱</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">日期</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">大小 (MB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {status.recentBackups.map((b) => (
                  <tr key={b.name} className="hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-2 font-mono text-xs">{b.name}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{b.date}</td>
                    <td className="px-4 py-2 text-xs text-right tabular-nums">{b.sizeMB}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <PageEmpty
          icon={<Database className="h-6 w-6" />}
          title="尚無備份紀錄"
          description="備份腳本執行後，此處將顯示備份歷史紀錄"
          className="py-8"
        />
      )}

      {/* Log viewer */}
      {status.lastLogLines.length > 0 && (
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium">備份日誌（最近 20 行）</h3>
          </div>
          <pre className="p-4 text-xs font-mono text-muted-foreground bg-accent/10 overflow-x-auto max-h-64 overflow-y-auto">
            {status.lastLogLines.join("\n")}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Audit Log Section ──────────────────────────────────────────────────────

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

function AuditLogSection() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "500" });
      if (actionFilter) params.set("action", actionFilter);
      const res = await fetch(`/api/audit?${params.toString()}`);
      if (!res.ok) throw new Error("稽核日誌載入失敗");
      const json = await res.json();
      setLogs(json.data ?? json);
      setPage(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  useEffect(() => { load(); }, [load]);

  // Client-side date filtering and pagination
  const filteredLogs = logs.filter((log) => {
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      if (new Date(log.createdAt) < from) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(log.createdAt) > to) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const pagedLogs = filteredLogs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Derive unique actions for filter dropdown
  const uniqueActions = Array.from(new Set(logs.map((l) => l.action))).sort();

  if (loading) return <PageLoading message="載入稽核日誌..." className="py-8" />;
  if (error) return <PageError message={error} onRetry={load} className="py-8" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          稽核日誌
        </h2>
        <button
          onClick={load}
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
            onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
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
            onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
            className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {(actionFilter || dateFrom || dateTo) && (
          <button
            onClick={() => { setActionFilter(""); setDateFrom(""); setDateTo(""); setPage(0); }}
            className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            清除篩選
          </button>
        )}
      </div>

      {/* Table */}
      {filteredLogs.length === 0 ? (
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
                {pagedLogs.map((log) => (
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
              共 {filteredLogs.length} 筆，第 {page + 1} / {totalPages} 頁
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
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

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect non-managers
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "MANAGER") {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  if (status === "loading") return <PageLoading />;

  if (session?.user?.role !== "MANAGER") {
    return (
      <PageError
        message="權限不足：僅限管理員存取此頁面"
        className="py-20"
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">系統管理</h1>
        <p className="text-sm text-muted-foreground mt-1">
          備份狀態監控與稽核日誌檢視
        </p>
      </div>

      <BackupStatusSection />
      <AuditLogSection />
    </div>
  );
}
