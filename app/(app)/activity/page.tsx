"use client";

/**
 * Activity Page — Issue #810 (AF-2)
 *
 * Refactored to use ActivityTimeline component with:
 * - Time-descending display (newest first)
 * - Human-readable event descriptions
 * - User avatars
 * - Date group separators (今天、昨天、更早)
 * - Infinite scroll (loads 50 per page)
 * - Skeleton loading + retry on error
 */

import { ActivityTimeline } from "@/app/components/activity-timeline";

export default function ActivityPage() {
  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex-shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">團隊動態</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          查看團隊成員的最新操作紀錄，按時間倒序排列
        </p>
      </div>

      {/* Timeline content */}
      <ActivityTimeline />
    </div>
  );
}
