"use client";

import { cn } from "@/lib/utils";

type VerificationStatus = "verified" | "expired" | "needs_review" | "none";

type VerificationBadgeProps = {
  verifiedAt: string | null;
  verifyIntervalDays: number | null;
  className?: string;
};

function getVerificationStatus(
  verifiedAt: string | null,
  verifyIntervalDays: number | null
): VerificationStatus {
  if (!verifyIntervalDays) return "none";
  if (!verifiedAt) return "expired";

  const dueDate = new Date(new Date(verifiedAt).getTime() + verifyIntervalDays * 86400000);
  const now = new Date();

  if (dueDate <= now) return "expired";
  if (dueDate.getTime() - now.getTime() < 7 * 86400000) return "needs_review";
  return "verified";
}

const STATUS_CONFIG: Record<VerificationStatus, { icon: string; label: string; className: string }> = {
  verified: {
    icon: "\u2705",
    label: "已驗證",
    className: "text-green-600 dark:text-green-400",
  },
  expired: {
    icon: "\u26A0\uFE0F",
    label: "已過期",
    className: "text-red-600 dark:text-red-400",
  },
  needs_review: {
    icon: "\uD83D\uDD04",
    label: "待複查",
    className: "text-amber-600 dark:text-amber-400",
  },
  none: {
    icon: "",
    label: "",
    className: "",
  },
};

export function VerificationBadge({ verifiedAt, verifyIntervalDays, className }: VerificationBadgeProps) {
  const status = getVerificationStatus(verifiedAt, verifyIntervalDays);
  if (status === "none") return null;

  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs font-medium", config.className, className)}
      title={`驗證狀態：${config.label}`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

export { getVerificationStatus };
export type { VerificationStatus };
