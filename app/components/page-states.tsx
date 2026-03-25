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

/** Reusable skeleton pulse bar */
export function SkeletonBar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} />;
}

/** Loading skeleton for list-style pages (Activity Feed, etc.) */
export function ListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3">
          <SkeletonBar className="mt-1.5 h-2 w-2 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <SkeletonBar className="h-4 w-16" />
              <SkeletonBar className="h-4 w-12" />
              <SkeletonBar className="h-4 w-32" />
            </div>
            <SkeletonBar className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Loading skeleton for form/settings pages */
export function FormSkeleton({ fields = 4, className }: { fields?: number; className?: string }) {
  return (
    <div className={cn("max-w-lg space-y-6", className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <SkeletonBar className="h-4 w-20" />
          <SkeletonBar className="h-10 w-full" />
        </div>
      ))}
      <SkeletonBar className="h-10 w-28" />
    </div>
  );
}

/** Loading skeleton for tab navigation pages */
export function TabSkeleton({ tabs = 3, className }: { tabs?: number; className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-1">
        <SkeletonBar className="h-6 w-32" />
        <SkeletonBar className="h-4 w-56" />
      </div>
      <div className="flex gap-1 border-b border-border pb-2">
        {Array.from({ length: tabs }).map((_, i) => (
          <SkeletonBar key={i} className="h-8 w-24" />
        ))}
      </div>
      <FormSkeleton fields={3} />
    </div>
  );
}

/** Generic page skeleton: title + subtitle + rows of content bars */
export function PageSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <SkeletonBar className="h-6 w-40" />
        <SkeletonBar className="h-4 w-64" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonBar key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Dashboard skeleton: stat cards + chart area */
export function DashboardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("max-w-4xl mx-auto space-y-6", className)}>
      <div className="space-y-2">
        <SkeletonBar className="h-6 w-32" />
        <SkeletonBar className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl p-4 space-y-2">
            <SkeletonBar className="h-3 w-16" />
            <SkeletonBar className="h-8 w-20" />
          </div>
        ))}
      </div>
      <div className="bg-card rounded-xl p-5 space-y-3">
        <SkeletonBar className="h-4 w-40" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between">
              <SkeletonBar className="h-3 w-20" />
              <SkeletonBar className="h-3 w-12" />
            </div>
            <SkeletonBar className="h-2 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Kanban skeleton: 5 columns with card placeholders */
export function KanbanSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <SkeletonBar className="h-6 w-20" />
          <SkeletonBar className="h-4 w-32" />
        </div>
        <SkeletonBar className="h-9 w-24" />
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} data-testid="kanban-col-skeleton" className="w-72 flex-shrink-0 rounded-xl border border-border p-2 space-y-2">
            <SkeletonBar className="h-8 w-full rounded-t-xl" />
            {Array.from({ length: 2 + (i % 2) }).map((_, j) => (
              <div key={j} className="bg-card rounded-lg p-3 space-y-2">
                <SkeletonBar className="h-4 w-full" />
                <SkeletonBar className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Timesheet skeleton: week header + grid rows */
export function TimesheetSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <SkeletonBar className="h-6 w-32" />
        <div className="flex gap-2">
          <SkeletonBar className="h-9 w-9" />
          <SkeletonBar className="h-9 w-40" />
          <SkeletonBar className="h-9 w-9" />
        </div>
      </div>
      <div className="bg-card rounded-xl p-4 space-y-3">
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBar key={i} className="h-8 flex-1" />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <SkeletonBar className="h-10 w-32 flex-shrink-0" />
            {Array.from({ length: 5 }).map((_, j) => (
              <SkeletonBar key={j} className="h-10 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Report skeleton: tabs + stat rows + chart placeholder */
export function ReportSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-1">
        <SkeletonBar className="h-6 w-24" />
        <SkeletonBar className="h-4 w-48" />
      </div>
      <div className="flex gap-1 border-b border-border pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBar key={i} className="h-8 w-20" />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl p-4 space-y-2">
            <SkeletonBar className="h-3 w-16" />
            <SkeletonBar className="h-6 w-12" />
          </div>
        ))}
      </div>
      <div className="bg-card rounded-xl p-5 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex justify-between py-2 border-b border-border/50">
            <SkeletonBar className="h-4 w-32" />
            <SkeletonBar className="h-4 w-16" />
          </div>
        ))}
      </div>
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
