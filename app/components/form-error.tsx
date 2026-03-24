"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Inline field error ──────────────────────────────────────────────────────

interface FormErrorProps {
  message?: string | null;
  className?: string;
}

export function FormError({ message, className }: FormErrorProps) {
  if (!message) return null;
  return (
    <p className={cn("flex items-center gap-1.5 text-xs text-red-400 mt-1", className)}>
      <AlertCircle className="h-3 w-3 flex-shrink-0" />
      {message}
    </p>
  );
}

// ── Form-level error banner ─────────────────────────────────────────────────

interface FormBannerProps {
  message?: string | null;
  className?: string;
}

export function FormBanner({ message, className }: FormBannerProps) {
  if (!message) return null;
  return (
    <div
      className={cn(
        "flex items-start gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm",
        className
      )}
    >
      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}
