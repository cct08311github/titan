"use client";

import { AlertCircle, Inbox, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingProps { message?: string; className?: string; }
export function PageLoading({ message = "載入中...", className }: LoadingProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground", className)}>
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

interface ErrorProps { message?: string; onRetry?: () => void; className?: string; }
export function PageError({ message = "載入失敗，請稍後再試", onRetry, className }: ErrorProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 py-20", className)}>
      <div className="w-12 h-12 rounded-xl bg-danger/10 flex items-center justify-center">
        <AlertCircle className="h-5 w-5 text-danger" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">發生錯誤</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-card hover:bg-accent text-foreground rounded-lg border border-border shadow-sm hover:shadow transition-all">
          <RefreshCw className="h-3.5 w-3.5" />
          重試
        </button>
      )}
    </div>
  );
}

interface EmptyProps { icon?: React.ReactNode; title?: string; description?: string; action?: React.ReactNode; className?: string; }
export function PageEmpty({ icon, title = "尚無資料", description, action, className }: EmptyProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 py-20", className)}>
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground/40">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground/70">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
