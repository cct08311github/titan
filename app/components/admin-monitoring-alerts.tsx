"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Loader2, Bell, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractItems } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

type AlertStatus = "FIRING" | "RESOLVED" | "ACKNOWLEDGED";
type AlertSeverity = "CRITICAL" | "WARNING" | "INFO";

interface MonitoringAlert {
  id: string;
  alertName: string;
  severity: AlertSeverity;
  status: AlertStatus;
  source: string;
  message: string;
  firedAt: string;
  resolvedAt: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  linkedTaskId: string | null;
}

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  WARNING: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  INFO: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const STATUS_LABELS: Record<AlertStatus | "ALL", string> = {
  ALL: "全部",
  FIRING: "發生中",
  RESOLVED: "已解決",
  ACKNOWLEDGED: "已確認",
};

export function AdminMonitoringAlerts() {
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<AlertStatus | "ALL">("ALL");
  const [since, setSince] = useState("");
  const [actioning, setActioning] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (since) params.set("since", new Date(since).toISOString());
      const res = await fetch(`/api/monitoring-alerts?${params}`);
      const body = await res.json();
      setAlerts(extractItems<MonitoringAlert>(body));
    } catch {
      toast.error("載入監控警報失敗");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, since]);

  // Initial load + auto-refresh every 30s
  useEffect(() => {
    setLoading(true);
    void load();

    intervalRef.current = setInterval(() => {
      void load();
    }, 30_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  const handleAction = async (alert: MonitoringAlert, action: "acknowledge" | "create_task") => {
    setActioning(`${alert.id}-${action}`);
    try {
      const res = await fetch(`/api/monitoring-alerts/${alert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "操作失敗");
      }
      toast.success(action === "acknowledge" ? "已確認警報" : "已建立任務");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失敗");
    } finally {
      setActioning(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">監控警報</span>
          <span className="text-xs text-muted-foreground">（每 30 秒自動更新）</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Since date filter */}
          <input
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className={cn(
              "bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground",
              "focus:outline-none focus:ring-1 focus:ring-ring"
            )}
          />
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AlertStatus | "ALL")}
            className={cn(
              "bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground",
              "focus:outline-none focus:ring-1 focus:ring-ring"
            )}
          >
            {(Object.keys(STATUS_LABELS) as Array<AlertStatus | "ALL">).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <button
            onClick={() => { setLoading(true); void load(); }}
            className="flex items-center gap-1.5 border border-border hover:bg-muted text-foreground text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重新整理
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">目前無警報記錄</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">警報名稱</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">嚴重程度</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">狀態</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">來源</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">觸發時間</th>
                <th className="px-4 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr
                  key={alert.id}
                  className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-2">
                    <div className="font-medium">{alert.alertName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">
                      {alert.message}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", SEVERITY_STYLES[alert.severity])}>
                      {alert.severity}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        alert.status === "FIRING"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : alert.status === "ACKNOWLEDGED"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      )}
                    >
                      {STATUS_LABELS[alert.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{alert.source}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {formatDateTime(alert.firedAt)}
                  </td>
                  <td className="px-4 py-2">
                    {alert.status === "FIRING" && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleAction(alert, "acknowledge")}
                          disabled={actioning === `${alert.id}-acknowledge`}
                          className="flex items-center gap-1 border border-border hover:bg-muted text-foreground text-xs px-2 py-1 rounded-md transition-colors disabled:opacity-50"
                        >
                          {actioning === `${alert.id}-acknowledge` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : null}
                          確認
                        </button>
                        <button
                          onClick={() => handleAction(alert, "create_task")}
                          disabled={actioning === `${alert.id}-create_task`}
                          className="flex items-center gap-1 bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-2 py-1 rounded-md transition-colors disabled:opacity-50"
                        >
                          {actioning === `${alert.id}-create_task` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : null}
                          建立任務
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
