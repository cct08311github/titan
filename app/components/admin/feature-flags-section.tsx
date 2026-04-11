"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Flag, RefreshCw, Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";

// ── Types ──────────────────────────────────────────────────────────────────

interface FeatureFlag {
  name: string;
  enabled: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────

const FLAG_DESCRIPTIONS: Record<string, string> = {
  V2_DASHBOARD: "啟用新版儀表板（v2）",
  V2_REPORTS: "啟用新版報表（v2）",
  ALERT_BANNER: "顯示全域警告橫幅",
};

// ── Component ──────────────────────────────────────────────────────────────

export function FeatureFlagsSection() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/feature-flags");
      if (!res.ok) throw new Error("功能開關載入失敗");
      const body = await res.json();
      const raw: Record<string, boolean> = body?.data?.flags ?? body?.flags ?? {};
      setFlags(Object.entries(raw).map(([name, enabled]) => ({ name, enabled })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(flag: FeatureFlag) {
    setToggling(flag.name);
    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: flag.name, enabled: !flag.enabled }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        toast.error(errBody?.message ?? "更新失敗");
        return;
      }
      const body = await res.json();
      const raw: Record<string, boolean> = body?.data?.flags ?? body?.flags ?? {};
      setFlags(Object.entries(raw).map(([name, enabled]) => ({ name, enabled })));
      toast.success(`已${!flag.enabled ? "開啟" : "關閉"}「${FLAG_DESCRIPTIONS[flag.name] ?? flag.name}」`);
    } catch {
      toast.error("更新失敗");
    } finally {
      setToggling(null);
    }
  }

  if (loading) return <PageLoading message="載入功能開關..." className="py-8" />;
  if (error) return <PageError message={error} onRetry={load} className="py-8" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Flag className="h-4 w-4 text-primary" />
          功能開關
        </h2>
        <button
          onClick={() => load()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-card hover:bg-accent text-foreground rounded-lg border border-border shadow-sm transition-all"
        >
          <RefreshCw className="h-3 w-3" />
          重新整理
        </button>
      </div>

      {flags.length === 0 ? (
        <PageEmpty
          icon={<Flag className="h-6 w-6" />}
          title="尚無功能開關"
          description="目前沒有已定義的功能開關"
          className="py-8"
        />
      ) : (
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-accent/30">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">功能名稱</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">說明</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground w-24">狀態</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground w-24">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {flags.map((flag) => (
                  <tr key={flag.name} className="hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{flag.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {FLAG_DESCRIPTIONS[flag.name] ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium",
                        flag.enabled
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      )}>
                        {flag.enabled ? "開啟" : "關閉"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleToggle(flag)}
                        disabled={toggling === flag.name}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border shadow-sm transition-all disabled:opacity-50",
                          flag.enabled
                            ? "bg-card hover:bg-accent text-foreground border-border"
                            : "bg-primary hover:bg-primary/90 text-primary-foreground border-transparent"
                        )}
                      >
                        {toggling === flag.name ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : flag.enabled ? (
                          <ToggleRight className="h-3 w-3" />
                        ) : (
                          <ToggleLeft className="h-3 w-3" />
                        )}
                        {flag.enabled ? "關閉" : "開啟"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
