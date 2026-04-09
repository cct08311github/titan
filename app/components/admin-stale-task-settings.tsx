"use client";

/**
 * Admin: Stale-Task Threshold Settings — Issue #1313
 *
 * Allows ADMIN users to configure the three-tier stale-task detection thresholds.
 * Changes are persisted via PUT /api/admin/settings/stale-task and take effect
 * on the next cron scan (cached 5 minutes in the service).
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Save, RotateCcw } from "lucide-react";

interface StaleTaskConfig {
  remindDays: number;
  warnDays: number;
  escalateDays: number;
}

const DEFAULT_CONFIG: StaleTaskConfig = {
  remindDays: 3,
  warnDays: 7,
  escalateDays: 14,
};

/** Client-side validation matching the Zod schema on the server */
function validateConfig(config: StaleTaskConfig): string | null {
  if (!Number.isInteger(config.remindDays) || config.remindDays < 1 || config.remindDays > 59) {
    return "提醒天數必須是 1–59 的整數";
  }
  if (!Number.isInteger(config.warnDays) || config.warnDays < 2 || config.warnDays > 60) {
    return "警告天數必須是 2–60 的整數";
  }
  if (!Number.isInteger(config.escalateDays) || config.escalateDays < 3 || config.escalateDays > 60) {
    return "升級天數必須是 3–60 的整數";
  }
  if (config.remindDays >= config.warnDays) {
    return "提醒天數必須小於警告天數";
  }
  if (config.warnDays >= config.escalateDays) {
    return "警告天數必須小於升級天數";
  }
  return null;
}

export function AdminStaleTaskSettings() {
  const [config, setConfig] = useState<StaleTaskConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/stale-task");
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? "載入設定失敗");
      }
      const data = await res.json();
      setConfig(data.data.config as StaleTaskConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入設定時發生錯誤");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function handleChange(field: keyof StaleTaskConfig, rawValue: string) {
    const num = parseInt(rawValue, 10);
    setConfig((prev) => ({ ...prev, [field]: isNaN(num) ? 0 : num }));
    setValidationError(null);
  }

  function handleReset() {
    setConfig(DEFAULT_CONFIG);
    setValidationError(null);
  }

  async function handleSave() {
    const err = validateConfig(config);
    if (err) {
      setValidationError(err);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/stale-task", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? "儲存失敗");
      }

      toast.success("停滯任務門檻已更新，將在下次掃描時生效");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "儲存設定時發生錯誤");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        載入停滯任務設定…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
        <button
          onClick={() => void load()}
          className="ml-2 underline underline-offset-2"
        >
          重新載入
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold">停滯任務門檻設定</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          設定任務停滯幾天後觸發各等級通知。更改後將在下次排程掃描時生效（最多延遲 5 分鐘）。
        </p>
      </div>

      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Remind */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="remindDays">
              提醒天數
              <span className="ml-1 text-muted-foreground font-normal">（第一層）</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="remindDays"
                type="number"
                min={1}
                max={59}
                value={config.remindDays}
                onChange={(e) => handleChange("remindDays", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">天</span>
            </div>
            <p className="text-xs text-muted-foreground">停滯超過此天數觸發提醒通知</p>
          </div>

          {/* Warn */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="warnDays">
              警告天數
              <span className="ml-1 text-muted-foreground font-normal">（第二層）</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="warnDays"
                type="number"
                min={2}
                max={60}
                value={config.warnDays}
                onChange={(e) => handleChange("warnDays", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">天</span>
            </div>
            <p className="text-xs text-muted-foreground">停滯超過此天數觸發警告通知（含主管）</p>
          </div>

          {/* Escalate */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="escalateDays">
              升級天數
              <span className="ml-1 text-muted-foreground font-normal">（第三層）</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="escalateDays"
                type="number"
                min={3}
                max={60}
                value={config.escalateDays}
                onChange={(e) => handleChange("escalateDays", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">天</span>
            </div>
            <p className="text-xs text-muted-foreground">停滯超過此天數觸發升級通知（含管理員）</p>
          </div>
        </div>

        {validationError && (
          <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded px-3 py-2">
            {validationError}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            預設值：提醒 3 天 · 警告 7 天 · 升級 14 天
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" />
              還原預設
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              儲存設定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
