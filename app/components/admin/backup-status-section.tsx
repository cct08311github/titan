"use client";

import { useState, useEffect, useCallback } from "react";
import { Database, HardDrive, RefreshCw } from "lucide-react";
import { extractData } from "@/lib/api-client";
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

// ── Component ──────────────────────────────────────────────────────────────

export function BackupStatusSection() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/backup-status");
      if (!res.ok) throw new Error("備份狀態載入失敗");
      const body = await res.json();
      setStatus(extractData<BackupStatus>(body));
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
          onClick={() => load()}
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
