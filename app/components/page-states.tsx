"use client";

import { AlertCircle, Inbox, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Loading ─────────────────────────────────────────────────────────────────

interface LoadingProps {
  message?: string;
  className?: string;
}

export function PageLoading({ message = "載入中...", className }: LoadingProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground", className)}>
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── Error ───────────────────────────────────────────────────────────────────

interface ErrorProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function PageError({
  message = "載入失敗，請稍後再試",
  onRetry,
  className,
}: ErrorProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 py-16", className)}>
      <div className="flex flex-col items-center gap-2 text-red-400">
        <AlertCircle className="h-7 w-7" />
        <p className="text-sm font-medium">發生錯誤</p>
      </div>
      <p className="text-sm text-muted-foreground text-center max-w-xs">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-accent hover:bg-accent/80 text-foreground rounded-md transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          重試
        </button>
      )}
    </div>
  );
}

// ── Empty ───────────────────────────────────────────────────────────────────

interface EmptyProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageEmpty({
  icon,
  title = "尚無資料",
  description,
  action,
  className,
}: EmptyProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground", className)}>
      <div className="text-muted-foreground/60">
        {icon ?? <Inbox className="h-10 w-10" />}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground/70">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
