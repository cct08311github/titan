/**
 * Notification Preferences Page — Issue #267
 *
 * Allows users to manage their notification subscription preferences.
 * Each notification type can be independently enabled/disabled.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { extractData } from "@/lib/api-client";

interface NotificationPref {
  type: string;
  enabled: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  TASK_ASSIGNED: "任務指派通知",
  TASK_DUE_SOON: "任務即將到期提醒",
  TASK_OVERDUE: "任務逾期通知",
  TASK_COMMENTED: "任務留言通知",
  MILESTONE_DUE: "里程碑到期提醒",
  BACKUP_ACTIVATED: "B 角啟用通知",
  TASK_CHANGED: "任務變更通知",
};

export default function NotificationPreferencesPage() {
  const { data: session } = useSession();
  const [preferences, setPreferences] = useState<NotificationPref[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const userId = (session?.user as { id?: string } | undefined)?.id;

  const fetchPreferences = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/users/${userId}/notification-preferences`);
      const body = await res.json();
      const data = extractData<{ preferences: NotificationPref[] }>(body);
      if (data?.preferences) {
        setPreferences(data.preferences);
      }
    } catch {
      setMessage("載入通知偏好失敗");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const handleToggle = (type: string) => {
    setPreferences((prev) =>
      prev.map((p) => (p.type === type ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/users/${userId}/notification-preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });
      const body = await res.json();
      const data = extractData<{ preferences: NotificationPref[] }>(body);
      if (res.ok && data?.preferences) {
        setMessage("通知偏好已儲存");
        setPreferences(data.preferences);
      } else {
        setMessage((body as { message?: string })?.message || "儲存失敗");
      }
    } catch {
      setMessage("網路錯誤，請稍後再試");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">通知偏好設定</h1>
        <p className="text-muted-foreground">載入中...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">通知偏好設定</h1>
      <p className="text-muted-foreground mb-6">
        選擇您想接收的通知類型。關閉後將不再收到該類型的站內通知。
      </p>

      <div className="space-y-3">
        {preferences.map((pref) => (
          <label
            key={pref.type}
            className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer"
          >
            <div>
              <span className="font-medium">
                {TYPE_LABELS[pref.type] || pref.type}
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={pref.enabled}
              onClick={() => handleToggle(pref.type)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                pref.enabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform ${
                  pref.enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </label>
        ))}
      </div>

      {message && (
        <p className="mt-4 text-sm text-muted-foreground">{message}</p>
      )}

      <div className="mt-6 flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "儲存中..." : "儲存偏好"}
        </button>
        <button
          onClick={fetchPreferences}
          disabled={loading}
          className="px-4 py-2 border rounded-md hover:bg-accent"
        >
          重設
        </button>
      </div>
    </div>
  );
}
