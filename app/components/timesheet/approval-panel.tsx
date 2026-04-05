"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Check, X, Filter, AlertTriangle } from "lucide-react";
import type { MonthlyMember } from "./use-monthly-timesheet";

type StatusFilter = "all" | "PENDING" | "APPROVED" | "REJECTED";

type ApprovalPanelProps = {
  members: MonthlyMember[];
  selectedCount: number;
  filteredCount: number;
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onToggleMember: (userId: string) => void;
  selectedEntryIds: Set<string>;
  getFilteredEntryIds: (userId: string) => string[];
  onApprove: () => Promise<Response | undefined>;
  onReject: (reason: string) => Promise<Response | undefined>;
};

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "PENDING", label: "待審核" },
  { value: "REJECTED", label: "已駁回" },
  { value: "APPROVED", label: "已核准" },
  { value: "all", label: "全部" },
];

export function ApprovalPanel({
  members,
  selectedCount,
  filteredCount,
  statusFilter,
  onStatusFilterChange,
  onSelectAll,
  onClearSelection,
  onToggleMember,
  selectedEntryIds,
  getFilteredEntryIds,
  onApprove,
  onReject,
}: ApprovalPanelProps) {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Compute summary of selected entries for the confirmation dialog
  const approveSummary = useMemo(() => {
    let entryCount = 0;
    let totalHours = 0;
    const affectedMemberIds = new Set<string>();
    const dates: string[] = [];

    for (const member of members) {
      for (const [date, day] of Object.entries(member.days)) {
        for (const entry of day.entries) {
          if (selectedEntryIds.has(entry.id)) {
            entryCount++;
            totalHours += entry.hours;
            affectedMemberIds.add(member.userId);
            dates.push(date);
          }
        }
      }
    }

    const sortedDates = dates.sort();
    return {
      entryCount,
      totalHours,
      memberCount: affectedMemberIds.size,
      dateMin: sortedDates[0] ?? "",
      dateMax: sortedDates[sortedDates.length - 1] ?? "",
    };
  }, [members, selectedEntryIds]);

  async function handleConfirmApprove() {
    setActionLoading(true);
    try {
      await onApprove();
      setShowConfirmDialog(false);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await onReject(rejectReason);
      setRejectReason("");
      setShowRejectDialog(false);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="border border-border rounded-lg bg-card p-4 space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Filter className="h-4 w-4" />
        審核面板
      </h3>

      {/* Status filter */}
      <div className="flex gap-1 flex-wrap">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onStatusFilterChange(opt.value)}
            className={cn(
              "px-2.5 py-1 rounded text-xs transition-colors",
              statusFilter === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Member checkboxes */}
      <div className="space-y-1 max-h-[200px] overflow-y-auto">
        {members.map((member) => {
          const memberIds = getFilteredEntryIds(member.userId);
          const allSelected = memberIds.length > 0 && memberIds.every((id) => selectedEntryIds.has(id));
          const someSelected = memberIds.some((id) => selectedEntryIds.has(id));

          return (
            <label
              key={member.userId}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                onChange={() => onToggleMember(member.userId)}
                disabled={memberIds.length === 0}
                className="rounded border-border"
              />
              <span className={memberIds.length === 0 ? "text-muted-foreground" : ""}>
                {member.name}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                {memberIds.length} 筆
              </span>
            </label>
          );
        })}
      </div>

      {/* Select all / clear */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {filteredCount} 筆符合條件，已選 {selectedCount} 筆
        </span>
        <div className="flex gap-2">
          <button onClick={onSelectAll} className="text-primary hover:underline">
            全選
          </button>
          <button onClick={onClearSelection} className="text-muted-foreground hover:underline">
            清除
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowConfirmDialog(true)}
          disabled={selectedCount === 0 || actionLoading}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            "bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <Check className="h-4 w-4" />
          核准 ({selectedCount})
        </button>
        <button
          onClick={() => setShowRejectDialog(true)}
          disabled={selectedCount === 0 || actionLoading}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <X className="h-4 w-4" />
          駁回 ({selectedCount})
        </button>
      </div>

      {/* Reject reason dialog */}
      {showRejectDialog && (
        <div className="border border-red-200 dark:border-red-800 rounded-md p-3 bg-red-50 dark:bg-red-950/30 space-y-2">
          <label className="text-xs font-medium text-red-800 dark:text-red-200">
            駁回理由（必填）
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="請輸入駁回理由..."
            className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background resize-none"
            rows={3}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowRejectDialog(false); setRejectReason(""); }}
              className="px-3 py-1 text-xs rounded bg-muted hover:bg-muted/80"
            >
              取消
            </button>
            <button
              onClick={handleReject}
              disabled={!rejectReason.trim() || actionLoading}
              className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              確認駁回
            </button>
          </div>
        </div>
      )}

      {/* Batch approve confirmation dialog */}
      {showConfirmDialog && (
        <div className="border border-green-200 dark:border-green-800 rounded-md p-3 bg-green-50 dark:bg-green-950/30 space-y-3">
          <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs font-medium">確認批次核准</span>
          </div>
          <div className="space-y-1 text-xs text-green-900 dark:text-green-100">
            <p>即將核准以下工時紀錄：</p>
            <ul className="ml-3 space-y-0.5 text-muted-foreground">
              <li>人數：{approveSummary.memberCount} 人</li>
              <li>筆數：{approveSummary.entryCount} 筆</li>
              <li>總時數：{approveSummary.totalHours.toFixed(1)} 小時</li>
              {approveSummary.dateMin && (
                <li>
                  日期範圍：{approveSummary.dateMin}
                  {approveSummary.dateMin !== approveSummary.dateMax
                    ? ` ~ ${approveSummary.dateMax}`
                    : ""}
                </li>
              )}
            </ul>
            <p className="text-amber-700 dark:text-amber-400 mt-1">
              核准後紀錄將鎖定，無法由主管自行撤回。
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowConfirmDialog(false)}
              disabled={actionLoading}
              className="px-3 py-1 text-xs rounded bg-muted hover:bg-muted/80 disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleConfirmApprove}
              disabled={actionLoading}
              className="px-3 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
            >
              <Check className="h-3 w-3" />
              {actionLoading ? "處理中..." : "確認核准"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
