"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";

interface Notification {
  id: string;
  type: string;
  title: string;
  message?: string | null;
  body?: string | null;
  isRead: boolean;
  createdAt: string;
}

/** Polling interval for notification refresh (ms). */
const NOTIFICATION_POLL_INTERVAL_MS = 60_000;

const TYPE_LABELS: Record<string, string> = {
  TASK_ASSIGNED: "任務指派",
  TASK_DUE_SOON: "即將到期",
  TASK_OVERDUE: "已逾期",
  TASK_COMMENTED: "新留言",
  MILESTONE_DUE: "里程碑提醒",
  BACKUP_ACTIVATED: "B 角啟動",
  TASK_CHANGED: "任務變更",
  DELIVERABLE_PENDING: "交付項待辦",
};

const TYPE_COLORS: Record<string, string> = {
  TASK_ASSIGNED: "bg-blue-500",
  TASK_DUE_SOON: "bg-yellow-500",
  TASK_OVERDUE: "bg-red-500",
  TASK_COMMENTED: "bg-green-500",
  MILESTONE_DUE: "bg-purple-500",
  BACKUP_ACTIVATED: "bg-orange-500",
  TASK_CHANGED: "bg-cyan-500",
  DELIVERABLE_PENDING: "bg-pink-500",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "剛剛";
  if (mins < 60) return `${mins} 分鐘前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    setLoading(true);
    try {
      // Fetch regular notifications
      const res = await fetch("/api/notifications?limit=15");
      let items: Notification[] = [];
      let unread = 0;
      if (res.ok) {
        const body = await res.json();
        const payload = extractData<{ items?: Notification[]; notifications?: Notification[]; unreadCount?: number }>(body);
        items = payload?.items ?? payload?.notifications ?? [];
        unread = payload?.unreadCount ?? 0;
      }

      // Fetch system alerts and prepend as notifications
      try {
        const alertRes = await fetch("/api/alerts/active");
        if (alertRes.ok) {
          const alertBody = await alertRes.json();
          const alerts = extractData<{ alerts?: Array<{ type: string; message: string }> }>(alertBody)?.alerts ?? [];
          const alertNotifs = alerts.map((a, i) => ({
            id: `alert-${i}`,
            type: a.type === "CRITICAL" ? "TASK_OVERDUE" : "TASK_DUE_SOON",
            message: a.message,
            isRead: false,
            createdAt: new Date().toISOString(),
          }));
          items = [...(alertNotifs as unknown as Notification[]), ...items];
          unread += alertNotifs.length;
        }
      } catch { /* alerts API optional */ }

      setNotifications(items);
      setUnreadCount(unread);
    } catch {
      toast.error("通知載入失敗");
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    const res = await fetch(`/api/notifications/${id}/read`, {
      method: "PATCH",
    });
    if (res.ok) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  }

  async function markAllRead() {
    const res = await fetch("/api/notifications/read-all", { method: "PATCH" });
    if (res.ok) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    }
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, NOTIFICATION_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) fetchNotifications();
        }}
        className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label={unreadCount > 0 ? `通知 (${unreadCount} 則未讀)` : "通知"}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 tabular-nums">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-96 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-medium">
              通知
              {unreadCount > 0 && (
                <span className="ml-2 text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">
                  {unreadCount} 未讀
                </span>
              )}
            </span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title="全部標為已讀"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                載入中...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                目前沒有通知
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.isRead && markRead(n.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-border/50 hover:bg-accent/50 transition-colors flex gap-3",
                    !n.isRead && "bg-primary/5"
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 w-2 h-2 rounded-full flex-shrink-0",
                      TYPE_COLORS[n.type] ?? "bg-muted-foreground",
                      n.isRead && "opacity-30"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {TYPE_LABELS[n.type] ?? n.type}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 tabular-nums">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-sm mt-0.5",
                        n.isRead ? "text-muted-foreground" : "text-foreground"
                      )}
                    >
                      {n.message || n.title || "通知"}
                    </p>
                    {n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                    )}
                    {!n.body && n.title && n.message && n.title !== n.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {n.title}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
