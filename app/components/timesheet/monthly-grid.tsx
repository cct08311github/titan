"use client";

import { cn } from "@/lib/utils";
import type { MonthlyMember, ApprovalStatus } from "./use-monthly-timesheet";

// ─── Types ────────────────────────────────────────────────────────────────────

type MonthlyGridProps = {
  members: MonthlyMember[];
  daysInMonth: number;
  month: string; // YYYY-MM
  expandedCell: { userId: string; date: string } | null;
  onCellClick: (userId: string, date: string) => void;
  onMemberClick?: (userId: string) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month - 1, day).getDay();
  return dow === 0 || dow === 6;
}

function getHoursColor(hours: number): string {
  if (hours === 0) return "bg-muted/30 text-muted-foreground/50";
  if (hours <= 8) return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200";
  if (hours <= 10) return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200";
  return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200";
}

function getApprovalIcon(status: ApprovalStatus): string {
  switch (status) {
    case "APPROVED": return "✓";
    case "REJECTED": return "✗";
    default: return "";
  }
}

function getApprovalIconColor(status: ApprovalStatus): string {
  switch (status) {
    case "APPROVED": return "text-green-600 dark:text-green-400";
    case "REJECTED": return "text-red-600 dark:text-red-400";
    default: return "";
  }
}

// ─── Components ──────────────────────────────────────────────────────────────

function MonthlyGridHeader({ daysInMonth, month }: { daysInMonth: number; month: string }) {
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const mon = parseInt(monthStr, 10);

  return (
    <tr className="border-b border-border">
      <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground min-w-[100px]">
        成員
      </th>
      {Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const dow = new Date(year, mon - 1, day).getDay();
        const weekend = isWeekend(year, mon, day);
        return (
          <th
            key={day}
            className={cn(
              "px-1 py-1 text-center text-xs font-normal min-w-[36px]",
              weekend && "bg-muted/50"
            )}
          >
            <div className="font-medium">{day}</div>
            <div className="text-muted-foreground/70 text-[10px]">{DAY_NAMES[dow]}</div>
          </th>
        );
      })}
      <th className="px-2 py-2 text-center text-xs font-medium text-muted-foreground min-w-[50px]">
        合計
      </th>
    </tr>
  );
}

function MonthlyCell({
  hours,
  approvalStatus,
  isWeekendDay,
  isExpanded,
  onClick,
}: {
  hours: number;
  approvalStatus: ApprovalStatus;
  isWeekendDay: boolean;
  isExpanded: boolean;
  onClick: () => void;
}) {
  const icon = getApprovalIcon(approvalStatus);
  const iconColor = getApprovalIconColor(approvalStatus);

  return (
    <td
      className={cn(
        "px-1 py-1 text-center cursor-pointer transition-colors hover:ring-1 hover:ring-primary/50",
        isWeekendDay && "bg-muted/30",
        isExpanded && "ring-2 ring-primary",
        hours === 0 ? "text-muted-foreground/30" : getHoursColor(hours)
      )}
      onClick={onClick}
    >
      <div className="text-xs font-mono leading-tight">
        {hours > 0 ? hours.toFixed(1) : "—"}
      </div>
      {icon && (
        <div className={cn("text-[9px] leading-none", iconColor)}>{icon}</div>
      )}
    </td>
  );
}

function MonthlyGridRow({
  member,
  daysInMonth,
  month,
  expandedCell,
  onCellClick,
  onMemberClick,
}: {
  member: MonthlyMember;
  daysInMonth: number;
  month: string;
  expandedCell: { userId: string; date: string } | null;
  onCellClick: (userId: string, date: string) => void;
  onMemberClick?: (userId: string) => void;
}) {
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const mon = parseInt(monthStr, 10);

  let totalHours = 0;

  const cells = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dateStr = `${yearStr}-${monthStr}-${String(day).padStart(2, "0")}`;
    const dayData = member.days[dateStr];
    const hours = dayData?.totalHours ?? 0;
    const status: ApprovalStatus = (dayData?.approvalStatus as ApprovalStatus) ?? "PENDING";
    totalHours += hours;

    return (
      <MonthlyCell
        key={day}
        hours={hours}
        approvalStatus={status}
        isWeekendDay={isWeekend(year, mon, day)}
        isExpanded={expandedCell?.userId === member.userId && expandedCell?.date === dateStr}
        onClick={() => onCellClick(member.userId, dateStr)}
      />
    );
  });

  return (
    <tr className="border-b border-border/50 hover:bg-muted/20">
      <td className="sticky left-0 z-10 bg-card px-3 py-2 text-sm font-medium min-w-[100px]">
        <button
          className="text-left hover:text-primary hover:underline transition-colors"
          onClick={() => onMemberClick?.(member.userId)}
          title={`查看 ${member.name} 的週報`}
        >
          {member.name}
        </button>
      </td>
      {cells}
      <td className="px-2 py-2 text-center text-xs font-mono font-semibold">
        {totalHours.toFixed(1)}
      </td>
    </tr>
  );
}

// ─── Main Grid ───────────────────────────────────────────────────────────────

export function MonthlyGrid({
  members,
  daysInMonth,
  month,
  expandedCell,
  onCellClick,
  onMemberClick,
}: MonthlyGridProps) {
  if (members.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        本月無工時資料
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <MonthlyGridHeader daysInMonth={daysInMonth} month={month} />
        </thead>
        <tbody>
          {members.map((member) => (
            <MonthlyGridRow
              key={member.userId}
              member={member}
              daysInMonth={daysInMonth}
              month={month}
              expandedCell={expandedCell}
              onCellClick={onCellClick}
              onMemberClick={onMemberClick}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Mobile List View ────────────────────────────────────────────────────────

export function MonthlyMobileList({
  members,
  month,
  onMemberClick,
}: {
  members: MonthlyMember[];
  month: string;
  onMemberClick?: (userId: string) => void;
}) {
  return (
    <div className="space-y-3">
      {members.map((member) => {
        let totalHours = 0;
        let approvedCount = 0;
        let pendingCount = 0;
        let rejectedCount = 0;

        for (const day of Object.values(member.days)) {
          totalHours += day.totalHours;
          for (const entry of day.entries) {
            if (entry.approvalStatus === "APPROVED") approvedCount++;
            else if (entry.approvalStatus === "REJECTED") rejectedCount++;
            else pendingCount++;
          }
        }

        return (
          <div
            key={member.userId}
            className="border border-border rounded-lg p-3 bg-card"
          >
            <div className="flex items-center justify-between mb-2">
              <button
                className="font-medium text-sm hover:text-primary hover:underline"
                onClick={() => onMemberClick?.(member.userId)}
              >
                {member.name}
              </button>
              <span className="text-sm font-mono font-semibold">
                {totalHours.toFixed(1)}h
              </span>
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>{month}</span>
              {pendingCount > 0 && <span className="text-yellow-600">待審 {pendingCount}</span>}
              {approvedCount > 0 && <span className="text-green-600">已核 {approvedCount}</span>}
              {rejectedCount > 0 && <span className="text-red-600">駁回 {rejectedCount}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
