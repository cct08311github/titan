"use client";

/**
 * TaskChangeHistory — Issue #806 (K-6)
 *
 * Displays task change history as a timeline:
 * - Status changes (with old/new values)
 * - Assignee changes
 * - Due date changes
 * - Priority changes
 * - Immutable audit trail (no edit/delete)
 * - Time displayed in Asia/Taipei timezone
 */

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  ArrowRight,
  Loader2,
  User,
  Calendar,
  AlertCircle,
  FileText,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";

type ChangeRecord = {
  id: string;
  taskId: string;
  changeType: "DELAY" | "SCOPE_CHANGE";
  reason: string;
  oldValue?: string | null;
  newValue?: string | null;
  changedBy: string;
  changedAt: string;
  changedByUser: { id: string; name: string };
};

type ActivityRecord = {
  id: string;
  taskId: string;
  userId: string;
  action: string;
  detail?: Record<string, unknown> | null;
  createdAt: string;
  user?: { id: string; name: string };
};

interface TaskChangeHistoryProps {
  taskId: string;
}

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: "待辦清單",
  TODO: "待處理",
  IN_PROGRESS: "進行中",
  REVIEW: "審核中",
  DONE: "已完成",
};

const PRIORITY_LABELS: Record<string, string> = {
  P0: "P0 緊急",
  P1: "P1 高",
  P2: "P2 中",
  P3: "P3 低",
};

const CHANGE_ICONS: Record<string, typeof Clock> = {
  STATUS_CHANGED: ArrowRight,
  DELAY: Calendar,
  SCOPE_CHANGE: FileText,
  ASSIGNEE_CHANGED: User,
  PRIORITY_CHANGED: AlertCircle,
  DEFAULT: Clock,
};

const CHANGE_COLORS: Record<string, string> = {
  STATUS_CHANGED: "text-blue-500 bg-blue-500/10",
  DELAY: "text-warning bg-warning/10",
  SCOPE_CHANGE: "text-purple-500 bg-purple-500/10",
  ASSIGNEE_CHANGED: "text-emerald-500 bg-emerald-500/10",
  PRIORITY_CHANGED: "text-red-500 bg-red-500/10",
  DEFAULT: "text-muted-foreground bg-muted",
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  // Display in Asia/Taipei timezone
  return d.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "剛才";
  if (mins < 60) return `${mins} 分鐘前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return formatDateTime(dateStr);
}

type TimelineItem = {
  id: string;
  type: string;
  user: string;
  timestamp: string;
  description: string;
  oldValue?: string | null;
  newValue?: string | null;
  reason?: string;
};

function buildTimeline(
  changes: ChangeRecord[],
  activities: ActivityRecord[]
): TimelineItem[] {
  const items: TimelineItem[] = [];

  // Add change records
  for (const c of changes) {
    let description = "";
    if (c.changeType === "DELAY") {
      const oldDate = c.oldValue ? new Date(c.oldValue).toLocaleDateString("zh-TW") : "無";
      const newDate = c.newValue ? new Date(c.newValue).toLocaleDateString("zh-TW") : "無";
      description = `延期：${oldDate} → ${newDate}`;
    } else if (c.changeType === "SCOPE_CHANGE") {
      description = "範圍變更";
    }

    items.push({
      id: c.id,
      type: c.changeType,
      user: c.changedByUser.name,
      timestamp: c.changedAt,
      description,
      oldValue: c.oldValue,
      newValue: c.newValue,
      reason: c.reason,
    });
  }

  // Add activity records
  for (const a of activities) {
    const detail = a.detail as Record<string, unknown> | null;
    let description = "";
    let type = a.action;

    if (a.action === "STATUS_CHANGED") {
      const oldStatus = detail?.oldStatus as string | undefined;
      const newStatus = detail?.status as string;
      const oldLabel = oldStatus ? STATUS_LABELS[oldStatus] ?? oldStatus : "未知";
      const newLabel = STATUS_LABELS[newStatus] ?? newStatus;
      description = `狀態變更：${oldLabel} → ${newLabel}`;
    } else if (a.action === "ASSIGNEE_CHANGED") {
      const oldName = (detail?.oldAssignee as string) ?? "未指派";
      const newName = (detail?.newAssignee as string) ?? "未指派";
      description = `負責人變更：${oldName} → ${newName}`;
    } else if (a.action === "PRIORITY_CHANGED") {
      const oldPri = PRIORITY_LABELS[(detail?.oldPriority as string) ?? ""] ?? String(detail?.oldPriority ?? "");
      const newPri = PRIORITY_LABELS[(detail?.newPriority as string) ?? ""] ?? String(detail?.newPriority ?? "");
      description = `優先度變更：${oldPri} → ${newPri}`;
    } else if (a.action === "DUE_DATE_CHANGED") {
      description = "到期日變更";
    } else {
      description = a.action;
    }

    items.push({
      id: a.id,
      type,
      user: a.user?.name ?? "系統",
      timestamp: a.createdAt,
      description,
    });
  }

  // Sort by timestamp descending (most recent first)
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Deduplicate: if a STATUS_CHANGED activity and a DELAY/SCOPE_CHANGE change
  // have the same timestamp (within 2 seconds), keep both but mark as related
  return items;
}

export function TaskChangeHistory({ taskId }: TaskChangeHistoryProps) {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ delayCount: 0, scopeChangeCount: 0 });

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const [changesRes, activitiesRes] = await Promise.all([
        fetch(`/api/tasks/${taskId}/changes`),
        fetch(`/api/tasks/${taskId}`),
      ]);

      let changes: ChangeRecord[] = [];
      let activities: ActivityRecord[] = [];

      if (changesRes.ok) {
        const body = await changesRes.json();
        const data = extractData<{
          changes: ChangeRecord[];
          delayCount: number;
          scopeChangeCount: number;
        }>(body);
        changes = data?.changes ?? [];
        setStats({
          delayCount: data?.delayCount ?? 0,
          scopeChangeCount: data?.scopeChangeCount ?? 0,
        });
      }

      // Extract activities from task detail
      if (activitiesRes.ok) {
        const body = await activitiesRes.json();
        const task = extractData<{
          activities?: ActivityRecord[];
        }>(body);
        activities = (task?.activities ?? []).map((a) => ({
          ...a,
          user: a.user ?? { id: a.userId, name: "使用者" },
        }));
      }

      setTimeline(buildTimeline(changes, activities));
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">稽核紀錄</span>
          <span className="font-medium text-foreground">{timeline.length}</span>
        </div>
        {stats.delayCount > 0 && (
          <div className="flex items-center gap-1 text-warning">
            <Calendar className="h-3 w-3" />
            <span>延期 {stats.delayCount} 次</span>
          </div>
        )}
        {stats.scopeChangeCount > 0 && (
          <div className="flex items-center gap-1 text-purple-500">
            <FileText className="h-3 w-3" />
            <span>範圍變更 {stats.scopeChangeCount} 次</span>
          </div>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground italic">
          變更歷史不可修改或刪除
        </span>
      </div>

      {/* Timeline */}
      {timeline.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          尚無變更紀錄
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

          <div className="space-y-4">
            {timeline.map((item) => {
              const Icon = CHANGE_ICONS[item.type] ?? CHANGE_ICONS.DEFAULT;
              const colorClass = CHANGE_COLORS[item.type] ?? CHANGE_COLORS.DEFAULT;

              return (
                <div key={item.id} className="flex gap-3 relative">
                  {/* Icon */}
                  <div
                    className={cn(
                      "h-[30px] w-[30px] rounded-full flex items-center justify-center flex-shrink-0 z-10",
                      colorClass
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm text-foreground">
                          {item.description}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {item.user}
                        </p>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                        <span className="text-[9px] text-muted-foreground/60 whitespace-nowrap">
                          {formatDateTime(item.timestamp)}
                        </span>
                      </div>
                    </div>

                    {/* Reason if present */}
                    {item.reason && (
                      <div className="mt-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                        原因：{item.reason}
                      </div>
                    )}

                    {/* Old → New values for scope changes */}
                    {item.type === "SCOPE_CHANGE" && item.oldValue && item.newValue && (
                      <div className="mt-1.5 text-xs space-y-0.5">
                        <div className="text-danger/80 line-through truncate">
                          {item.oldValue.substring(0, 100)}
                        </div>
                        <div className="text-emerald-600 truncate">
                          {item.newValue.substring(0, 100)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
