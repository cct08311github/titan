"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Download,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMonthlyTimesheet } from "@/app/components/timesheet/use-monthly-timesheet";
import { MonthlyGrid, MonthlyMobileList } from "@/app/components/timesheet/monthly-grid";
import { MonthlyDayDetail } from "@/app/components/timesheet/monthly-day-detail";
import { ApprovalPanel } from "@/app/components/timesheet/approval-panel";
import { MonthlySummary } from "@/app/components/timesheet/monthly-summary";
import { PageLoading, PageError } from "@/app/components/page-states";

export default function MonthlyTimesheetPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const isManager = session?.user?.role === "MANAGER";
  const [isMobile, setIsMobile] = useState(false);

  // RBAC guard
  useEffect(() => {
    if (sessionStatus === "authenticated" && !isManager) {
      router.replace("/timesheet");
    }
  }, [sessionStatus, isManager, router]);

  // Mobile detection
  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < 768);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const ts = useMonthlyTimesheet();

  // Find expanded cell data
  const expandedMember = ts.expandedCell
    ? ts.data?.members.find((m) => m.userId === ts.expandedCell!.userId)
    : null;
  const expandedEntries = expandedMember && ts.expandedCell
    ? expandedMember.days[ts.expandedCell.date]?.entries ?? []
    : [];

  // Get filtered entry IDs for a member (need to pass to ApprovalPanel)
  const getFilteredEntryIds = useCallback(
    (userId: string): string[] => {
      if (!ts.data) return [];
      const member = ts.data.members.find((m) => m.userId === userId);
      if (!member) return [];
      const ids: string[] = [];
      for (const day of Object.values(member.days)) {
        for (const entry of day.entries) {
          if (ts.statusFilter === "all" || entry.approvalStatus === ts.statusFilter) {
            if (!entry.isRunning) {
              ids.push(entry.id);
            }
          }
        }
      }
      return ids;
    },
    [ts.data, ts.statusFilter]
  );

  function handleMemberClick(userId: string) {
    // Navigate to weekly timesheet filtered by this user
    router.push(`/timesheet?userId=${userId}`);
  }

  function handleCellClick(userId: string, date: string) {
    if (ts.expandedCell?.userId === userId && ts.expandedCell?.date === date) {
      ts.setExpandedCell(null);
    } else {
      ts.setExpandedCell({ userId, date });
    }
  }

  if (sessionStatus === "loading") {
    return <PageLoading message="載入中..." />;
  }

  if (!isManager) {
    return null;
  }

  // Format month display
  const [yearStr, monthStr] = ts.month.split("-");
  const monthDisplay = `${yearStr} 年 ${parseInt(monthStr, 10)} 月`;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/timesheet")}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            title="回到週報"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-lg font-semibold">月報審核</h1>
        </div>

        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={ts.prevMonth}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="上個月"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium min-w-[120px] text-center">{monthDisplay}</span>
          <button
            onClick={ts.nextMonth}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="下個月"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={ts.goToThisMonth}
            className="px-2.5 py-1 text-xs rounded-md border border-border hover:bg-muted transition-colors"
          >
            <Calendar className="h-3 w-3 inline mr-1" />
            本月
          </button>
          <button
            onClick={ts.exportCSV}
            disabled={!ts.data}
            className="px-2.5 py-1 text-xs rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Download className="h-3 w-3 inline mr-1" />
            匯出 CSV
          </button>
        </div>
      </div>

      {/* Summary */}
      {ts.summary && !ts.summaryLoading && (
        <MonthlySummary summary={ts.summary} />
      )}

      {/* Main content */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Grid area */}
        <div className="flex-1 min-w-0">
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            {ts.loading ? (
              <PageLoading message="載入月報..." className="py-12" />
            ) : ts.error ? (
              <PageError message={ts.error} onRetry={ts.refresh} className="py-12" />
            ) : ts.data ? (
              isMobile ? (
                <div className="p-3">
                  <MonthlyMobileList
                    members={ts.data.members}
                    month={ts.data.month}
                    onMemberClick={handleMemberClick}
                  />
                </div>
              ) : (
                <MonthlyGrid
                  members={ts.data.members}
                  daysInMonth={ts.data.daysInMonth}
                  month={ts.data.month}
                  expandedCell={ts.expandedCell}
                  onCellClick={handleCellClick}
                  onMemberClick={handleMemberClick}
                />
              )
            ) : null}
          </div>

          {/* Expanded day detail */}
          {ts.expandedCell && expandedMember && (
            <div className="mt-3">
              <MonthlyDayDetail
                memberName={expandedMember.name}
                date={ts.expandedCell.date}
                entries={expandedEntries}
                selectedEntryIds={ts.selectedEntryIds}
                onToggleEntry={ts.toggleEntrySelection}
                onClose={() => ts.setExpandedCell(null)}
              />
            </div>
          )}
        </div>

        {/* Approval panel (sidebar on desktop, below on mobile) */}
        {ts.data && (
          <div className="lg:w-[280px] flex-shrink-0">
            <ApprovalPanel
              members={ts.data.members}
              selectedCount={ts.selectedEntryIds.size}
              filteredCount={ts.filteredCount}
              statusFilter={ts.statusFilter}
              onStatusFilterChange={ts.setStatusFilter}
              onSelectAll={ts.selectAll}
              onClearSelection={ts.clearSelection}
              onToggleMember={ts.toggleMemberSelection}
              selectedEntryIds={ts.selectedEntryIds}
              getFilteredEntryIds={getFilteredEntryIds}
              onApprove={ts.batchApprove}
              onReject={ts.batchReject}
            />
          </div>
        )}
      </div>

      {/* Help text */}
      <div className="text-xs text-muted-foreground/50 pb-2">
        點擊格子查看當日工時詳情。勾選工時記錄後可批次核准或駁回。成員名稱可點擊跳轉至週報。
      </div>
    </div>
  );
}
