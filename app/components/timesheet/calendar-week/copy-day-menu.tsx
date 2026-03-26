"use client";

import { formatLocalDate } from "@/lib/utils/date";

const DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function getDayDate(weekStart: Date, dayIndex: number): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayIndex);
  return d;
}

export type CopyMenuState = {
  sourceDayIndex: number;
  x: number;
  y: number;
};

type CopyDayMenuProps = {
  menu: CopyMenuState;
  weekStart: Date;
  onCopyTo: (targetDayIndex: number) => void;
  onClose: () => void;
};

export function CopyDayMenu({ menu, weekStart, onCopyTo, onClose }: CopyDayMenuProps) {
  return (
    <div
      className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[140px]"
      style={{ left: menu.x, top: menu.y }}
      data-testid="copy-day-menu"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border mb-1">
        複製週{DAY_LABELS[menu.sourceDayIndex]}到...
      </div>
      {DAY_LABELS.map((label, i) => {
        if (i === menu.sourceDayIndex) return null;
        return (
          <button
            key={i}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors"
            onClick={() => onCopyTo(i)}
            data-testid={`copy-to-day-${i}`}
          >
            週{label}（{getDayDate(weekStart, i).getDate()}日）
          </button>
        );
      })}
    </div>
  );
}

export { DAY_LABELS, getDayDate };
