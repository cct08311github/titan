"use client";

import { cn } from "@/lib/utils";
import { formatRelative, formatDateTime } from "@/lib/format";
import { formatActivityDescription } from "@/lib/utils/activity-formatter";
import { useFeatureFlag } from "@/lib/hooks/use-feature-flag";
import { ReactionBar } from "@/app/components/reaction-bar";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ActivityItemData {
  id: string;
  source: "task_activity" | "audit_log";
  action: string;
  userId: string | null;
  userName: string | null;
  resourceType: string;
  resourceId: string | null;
  resourceName: string | null;
  detail: unknown;
  metadata: unknown;
  createdAt: string;
}

// ── Source Badge ────────────────────────────────────────────────────────────

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  task_activity: { label: "任務", className: "bg-blue-500/10 text-blue-500" },
  audit_log: { label: "系統", className: "bg-amber-500/10 text-amber-500" },
};

// ── Avatar ─────────────────────────────────────────────────────────────────

function UserAvatar({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase();
  // Generate a consistent color from the name
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
  ];
  const colorIdx = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;

  return (
    <div
      className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium text-white flex-shrink-0",
        colors[colorIdx]
      )}
    >
      {initial}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

interface ActivityItemProps {
  item: ActivityItemData;
}

export function ActivityItem({ item }: ActivityItemProps) {
  const badge = SOURCE_BADGE[item.source];
  const description = formatActivityDescription({
    action: item.action,
    userName: item.userName,
    resourceType: item.resourceType,
    resourceName: item.resourceName,
    detail: item.detail,
    metadata: item.metadata,
  });

  const userName = item.userName ?? "系統";
  // Issue #1512: reactions gated behind FEATURE_REACTIONS + restricted to
  // task_activity sources (audit_log items live in a different table that
  // the reactions API does not target — the 404 would just create noise).
  const { enabled: reactionsEnabled } = useFeatureFlag("FEATURE_REACTIONS");
  const canReact = reactionsEnabled && item.source === "task_activity";

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-accent/30 transition-colors rounded-lg">
      {/* Avatar */}
      <UserAvatar name={userName} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Description */}
        <p className="text-sm text-foreground leading-relaxed">
          {description}
        </p>

        {/* Detail string (if any) */}
        {typeof item.detail === "string" && item.detail && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {item.detail}
          </p>
        )}

        {/* Footer: timestamp + source badge */}
        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-[11px] text-muted-foreground/60 cursor-help"
            title={formatDateTime(item.createdAt)}
          >
            {formatRelative(item.createdAt)}
          </span>
          {badge && (
            <span
              className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded",
                badge.className
              )}
            >
              {badge.label}
            </span>
          )}
        </div>

        {canReact && (
          <ReactionBar targetType="ACTIVITY" targetId={item.id} />
        )}
      </div>
    </div>
  );
}
