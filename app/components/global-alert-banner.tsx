"use client";

/**
 * GlobalAlertBanner — Issue #986
 *
 * Displays system-level alerts at the top of the layout.
 * - Red for CRITICAL, yellow for WARNING
 * - Dismissable per-session (sessionStorage)
 * - Auto-refresh every 5 minutes
 * - Click navigates to relevant page
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  level: "CRITICAL" | "WARNING";
  category: string;
  message: string;
  link: string;
  createdAt: string;
}

const STORAGE_KEY = "titan-dismissed-alerts";
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

function getDismissedAlerts(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissedAlerts(dismissed: Set<string>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed]));
  } catch {
    // ignore
  }
}

export function GlobalAlertBanner() {
  const { data: session } = useSession();
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const isManager = session?.user?.role === "MANAGER" || session?.user?.role === "ADMIN";

  const fetchAlerts = useCallback(async () => {
    if (!isManager) return;
    try {
      const res = await fetch("/api/alerts/active");
      if (!res.ok) return;
      const body = await res.json();
      if (body.ok && body.data?.alerts) {
        setAlerts(body.data.alerts);
      }
    } catch {
      // silently ignore
    }
  }, [isManager]);

  useEffect(() => {
    setDismissed(getDismissedAlerts());
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleDismiss = (alertId: string) => {
    const next = new Set(dismissed);
    next.add(alertId);
    setDismissed(next);
    saveDismissedAlerts(next);
  };

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.id));

  if (!isManager || visibleAlerts.length === 0) return null;

  return (
    <div className="w-full space-y-1 px-4 pt-2" data-testid="global-alert-banner">
      {visibleAlerts.map((alert) => (
        <div
          key={alert.id}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer",
            alert.level === "CRITICAL"
              ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200"
          )}
          onClick={() => router.push(alert.link)}
          role="alert"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{alert.message}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss(alert.id);
            }}
            className="flex-shrink-0 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"
            aria-label="關閉警示"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
