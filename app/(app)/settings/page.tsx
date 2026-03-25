"use client";

import { useState, useEffect, useCallback } from "react";
import { User, Bell, Lock, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData, extractItems } from "@/lib/api-client";
import { PageError, TabSkeleton } from "@/app/components/page-states";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
}

interface NotificationPref {
  id: string;
  type: string;
  enabled: boolean;
}

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  TASK_ASSIGNED: "任務指派",
  TASK_DUE_SOON: "任務即將到期",
  TASK_OVERDUE: "任務逾期",
  TASK_COMMENTED: "任務留言",
  MILESTONE_DUE: "里程碑到期",
  BACKUP_ACTIVATED: "B 角啟動",
  TASK_CHANGED: "任務變更",
  TIMESHEET_REMINDER: "工時填報提醒",
};

type Tab = "profile" | "notifications" | "security";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [prefs, setPrefs] = useState<NotificationPref[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form state for profile
  const [name, setName] = useState("");

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/auth/session");
      if (!res.ok) throw new Error("無法取得使用者資訊");
      const sessionBody = await res.json();
      const userId = sessionBody?.user?.id;
      if (!userId) throw new Error("未登入");

      const userRes = await fetch(`/api/users/${userId}`);
      if (!userRes.ok) throw new Error("無法取得使用者資料");
      const userBody = await userRes.json();
      const userData = extractData<UserProfile>(userBody);
      setProfile(userData);
      setName(userData?.name ?? "");

      // Fetch notification preferences
      const prefRes = await fetch(`/api/users/${userId}/notification-preferences`);
      if (prefRes.ok) {
        const prefBody = await prefRes.json();
        setPrefs(extractItems<NotificationPref>(prefBody));
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/users/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function togglePref(type: string, enabled: boolean) {
    if (!profile) return;
    const res = await fetch(`/api/users/${profile.id}/notification-preferences`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: [{ type, enabled }] }),
    });
    if (res.ok) {
      setPrefs((prev) =>
        prev.map((p) => (p.type === type ? { ...p, enabled } : p))
      );
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: "profile", label: "個人資料", icon: User },
    { id: "notifications", label: "通知偏好", icon: Bell },
    { id: "security", label: "安全設定", icon: Lock },
  ];

  if (loading) return <TabSkeleton tabs={3} />;
  if (fetchError) return <PageError message={fetchError} onRetry={fetchProfile} />;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex-shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">個人設定</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          管理你的個人資料、通知偏好與安全設定
        </p>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex gap-1 border-b border-border">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "profile" && (
          <div className="max-w-lg space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                姓名
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                電子信箱
              </label>
              <input
                type="email"
                value={profile?.email ?? ""}
                disabled
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground mt-1">
                電子信箱由管理員設定，無法自行修改
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                角色
              </label>
              <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                {profile?.role === "MANAGER" ? "管理員" : "工程師"}
              </span>
            </div>

            <button
              onClick={saveProfile}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saveSuccess ? "已儲存" : "儲存變更"}
            </button>
          </div>
        )}

        {activeTab === "notifications" && (
          <div className="max-w-lg space-y-4">
            <p className="text-sm text-muted-foreground">
              選擇要接收的通知類型
            </p>
            <div className="space-y-2">
              {Object.entries(NOTIFICATION_TYPE_LABELS).map(([type, label]) => {
                const pref = prefs.find((p) => p.type === type);
                const isEnabled = pref?.enabled ?? true;
                return (
                  <div
                    key={type}
                    className="flex items-center justify-between px-4 py-3 rounded-lg border border-border"
                  >
                    <span className="text-sm font-medium">{label}</span>
                    <button
                      onClick={() => togglePref(type, !isEnabled)}
                      className={cn(
                        "relative w-10 h-5 rounded-full transition-colors",
                        isEnabled ? "bg-primary" : "bg-muted"
                      )}
                      role="switch"
                      aria-checked={isEnabled}
                      aria-label={`${label} 通知`}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                          isEnabled && "translate-x-5"
                        )}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "security" && (
          <div className="max-w-lg space-y-6">
            <div className="px-4 py-4 rounded-lg border border-border space-y-2">
              <h3 className="text-sm font-medium text-foreground">變更密碼</h3>
              <p className="text-xs text-muted-foreground">
                密碼需定期更換（每 90 天），系統會在密碼到期前提醒您。
              </p>
              <a
                href="/change-password"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-accent transition-colors"
              >
                <Lock className="h-4 w-4" />
                前往變更密碼
              </a>
            </div>

            <div className="px-4 py-4 rounded-lg border border-border space-y-2">
              <h3 className="text-sm font-medium text-foreground">帳號安全</h3>
              <p className="text-xs text-muted-foreground">
                如有帳號安全疑慮（如密碼洩漏、可疑登入），請立即聯繫管理員。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
