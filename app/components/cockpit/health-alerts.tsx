"use client";

import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  type: "CRITICAL" | "WARNING" | "INFO";
  category: "GOAL" | "KPI" | "TASK" | "MILESTONE";
  message: string;
  targetId: string;
  targetType: string;
}

interface HealthAlertsProps {
  alerts: Alert[];
  onAlertClick?: (alert: Alert) => void;
}

const iconMap = {
  CRITICAL: AlertTriangle,
  WARNING: AlertCircle,
  INFO: Info,
};

const styleMap = {
  CRITICAL: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200",
  WARNING: "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200",
  INFO: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200",
};

const iconColorMap = {
  CRITICAL: "text-red-600 dark:text-red-400",
  WARNING: "text-yellow-600 dark:text-yellow-400",
  INFO: "text-blue-600 dark:text-blue-400",
};

export function HealthAlerts({ alerts, onAlertClick }: HealthAlertsProps) {
  if (alerts.length === 0) return null;

  // Sort: CRITICAL first, then WARNING, then INFO
  const sorted = [...alerts].sort((a, b) => {
    const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return order[a.type] - order[b.type];
  });

  return (
    <div className="space-y-2" data-testid="health-alerts">
      {sorted.map((alert, i) => {
        const Icon = iconMap[alert.type];
        return (
          <button
            key={`${alert.targetId}-${i}`}
            onClick={() => onAlertClick?.(alert)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-sm text-left transition-opacity hover:opacity-80",
              styleMap[alert.type],
            )}
          >
            <Icon className={cn("h-4 w-4 flex-shrink-0", iconColorMap[alert.type])} />
            <span>{alert.message}</span>
          </button>
        );
      })}
    </div>
  );
}
