"use client";

/**
 * NotificationPreferences — Issue #846 (S-2)
 *
 * Grouped notification preference toggles with:
 * - Category grouping (任務、工時、KPI、系統)
 * - Per-type toggle switches
 * - System announcements forced ON (non-disableable)
 * - Instant save on toggle
 */

import { useState } from "react";
import { cn } from "@/lib/utils";

interface NotificationPref {
  type: string;
  enabled: boolean;
}

interface NotificationPreferencesProps {
  userId: string;
  preferences: NotificationPref[];
  onUpdate: (type: string, enabled: boolean) => void;
}

type NotificationCategory = {
  label: string;
  description: string;
  types: { type: string; label: string; description: string; forced?: boolean }[];
};

const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    label: "任務通知",
    description: "任務相關的指派、狀態變更與到期提醒",
    types: [
      { type: "TASK_ASSIGNED", label: "任務指派", description: "當你被指派為新任務的負責人" },
      { type: "TASK_CHANGED", label: "任務狀態變更", description: "你負責的任務狀態發生變化" },
      { type: "TASK_DUE_SOON", label: "任務即將到期", description: "你的任務即將到期（7天內）" },
      { type: "TASK_OVERDUE", label: "任務逾期", description: "你的任務已超過到期日" },
    ],
  },
  {
    // Issue #1536: split MENTION / TASK_COMMENTED / REACTION_DIGEST as
    // distinct categories. They got conflated when TASK_COMMENTED's
    // semantics shifted from "you were @mentioned" to "thread you
    // commented in got a new reply" (#1523).
    label: "對話通知",
    description: "提及、回覆與反應的通知",
    types: [
      { type: "MENTION", label: "@mention 提及", description: "有人在留言中明確 @ 你" },
      { type: "TASK_COMMENTED", label: "對話自動訂閱", description: "你曾經參與留言的任務或文件，有新留言時通知（可在留言區用 🔕 按鈕單獨靜音）" },
      { type: "REACTION_DIGEST", label: "反應每日彙總", description: "每天早上 8:15 通知昨日有誰對你的留言做了 emoji 反應" },
    ],
  },
  {
    label: "工時通知",
    description: "工時填報提醒與審核結果",
    types: [
      { type: "TIMESHEET_REMINDER", label: "工時填報提醒", description: "每日/每週工時填報提醒" },
      { type: "TIMESHEET_REJECTED", label: "工時審核駁回", description: "你的工時記錄被審核者駁回" },
    ],
  },
  {
    label: "計畫通知",
    description: "里程碑與年度計畫相關提醒",
    types: [
      { type: "MILESTONE_DUE", label: "里程碑到期", description: "里程碑計畫結束日即將到來" },
      { type: "BACKUP_ACTIVATED", label: "B 角啟動", description: "你被啟用為任務的 B 角負責人" },
    ],
  },
];

export function NotificationPreferences({ userId, preferences, onUpdate }: NotificationPreferencesProps) {
  const [saving, setSaving] = useState<string | null>(null);

  function isEnabled(type: string): boolean {
    const pref = preferences.find((p) => p.type === type);
    return pref?.enabled ?? true; // Default: enabled
  }

  async function handleToggle(type: string, enabled: boolean) {
    setSaving(type);
    try {
      await onUpdate(type, enabled);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        選擇要接收的通知類型
      </p>

      {NOTIFICATION_CATEGORIES.map((category) => (
        <div key={category.label} className="space-y-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{category.label}</h3>
            <p className="text-xs text-muted-foreground">{category.description}</p>
          </div>

          <div className="space-y-1">
            {category.types.map(({ type, label, description, forced }) => {
              const enabled = forced ? true : isEnabled(type);
              return (
                <div
                  key={type}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border border-border"
                >
                  <div className="min-w-0 pr-4">
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  </div>
                  <button
                    onClick={() => !forced && handleToggle(type, !enabled)}
                    disabled={forced || saving === type}
                    className={cn(
                      "relative w-10 h-5 rounded-full transition-colors flex-shrink-0",
                      enabled ? "bg-primary" : "bg-muted",
                      forced && "opacity-60 cursor-not-allowed"
                    )}
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`${label} 通知`}
                    title={forced ? "系統通知無法關閉" : undefined}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                        enabled && "translate-x-5"
                      )}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
