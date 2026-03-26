"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { extractData } from "@/lib/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type MonthlyEntry = {
  id: string;
  taskId: string | null;
  date: string;
  hours: number;
  category: string;
  description: string | null;
  overtimeType: string;
  approvalStatus: ApprovalStatus;
  isRunning: boolean;
  locked: boolean;
  task?: { id: string; title: string; category?: string } | null;
};

export type MonthlyDay = {
  totalHours: number;
  entries: MonthlyEntry[];
  approvalStatus: ApprovalStatus;
};

export type MonthlyMember = {
  userId: string;
  name: string;
  email: string;
  days: Record<string, MonthlyDay>;
};

export type MonthlyData = {
  month: string;
  daysInMonth: number;
  members: MonthlyMember[];
};

export type MemberStat = {
  userId: string;
  name: string;
  totalHours: number;
  expectedHours: number;
  weekdayOvertime: number;
  holidayOvertime: number;
  totalOvertime: number;
  missingDays: string[];
  missingDayCount: number;
  approval: { pending: number; approved: number; rejected: number; total: number };
};

export type MonthlySummaryData = {
  month: string;
  workdays: number;
  daysInMonth: number;
  expectedHoursPerMember: number;
  teamOvertime: { weekday: number; holiday: number; total: number };
  overtimeRanking: { rank: number; userId: string; name: string; totalOvertime: number }[];
  approvalProgress: { pending: number; approved: number; rejected: number; total: number };
  members: MemberStat[];
};

type StatusFilter = "all" | "PENDING" | "APPROVED" | "REJECTED";

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMonthlyTimesheet() {
  // Month navigation
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Data
  const [data, setData] = useState<MonthlyData | null>(null);
  const [summary, setSummary] = useState<MonthlySummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");

  // Expanded cell
  const [expandedCell, setExpandedCell] = useState<{
    userId: string;
    date: string;
  } | null>(null);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/time-entries/monthly?month=${month}`);
      if (!res.ok) throw new Error("月報資料載入失敗");
      const body = await res.json();
      setData(extractData<MonthlyData>(body));
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [month]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch(`/api/time-entries/monthly-summary?month=${month}`);
      if (res.ok) {
        const body = await res.json();
        setSummary(extractData<MonthlySummaryData>(body));
      }
    } finally {
      setSummaryLoading(false);
    }
  }, [month]);

  useEffect(() => {
    loadData();
    loadSummary();
  }, [loadData, loadSummary]);

  // ─── Month Navigation ──────────────────────────────────────────────────────

  function prevMonth() {
    setMonth((prev) => {
      const [y, m] = prev.split("-").map(Number);
      const d = new Date(y, m - 2, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    setSelectedEntryIds(new Set());
    setExpandedCell(null);
  }

  function nextMonth() {
    setMonth((prev) => {
      const [y, m] = prev.split("-").map(Number);
      const d = new Date(y, m, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    setSelectedEntryIds(new Set());
    setExpandedCell(null);
  }

  function goToThisMonth() {
    const now = new Date();
    setMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    setSelectedEntryIds(new Set());
    setExpandedCell(null);
  }

  // ─── Selection ─────────────────────────────────────────────────────────────

  /** Get all entry IDs matching current filters for a member */
  function getFilteredEntryIds(userId: string): string[] {
    if (!data) return [];
    const member = data.members.find((m) => m.userId === userId);
    if (!member) return [];

    const ids: string[] = [];
    for (const day of Object.values(member.days)) {
      for (const entry of day.entries) {
        if (statusFilter === "all" || entry.approvalStatus === statusFilter) {
          if (!entry.isRunning) {
            ids.push(entry.id);
          }
        }
      }
    }
    return ids;
  }

  function toggleMemberSelection(userId: string) {
    const memberIds = getFilteredEntryIds(userId);
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      const allSelected = memberIds.every((id) => next.has(id));
      if (allSelected) {
        memberIds.forEach((id) => next.delete(id));
      } else {
        memberIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleEntrySelection(entryId: string) {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }

  function selectAll() {
    if (!data) return;
    const allIds: string[] = [];
    for (const member of data.members) {
      allIds.push(...getFilteredEntryIds(member.userId));
    }
    setSelectedEntryIds(new Set(allIds));
  }

  function clearSelection() {
    setSelectedEntryIds(new Set());
  }

  // ─── Filtered count ────────────────────────────────────────────────────────

  const filteredCount = useMemo(() => {
    if (!data) return 0;
    let count = 0;
    for (const member of data.members) {
      count += getFilteredEntryIds(member.userId).length;
    }
    return count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, statusFilter]);

  // ─── Batch Actions ─────────────────────────────────────────────────────────

  async function batchApprove() {
    if (selectedEntryIds.size === 0) return;
    const res = await fetch("/api/time-entries/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryIds: Array.from(selectedEntryIds) }),
    });
    if (res.ok) {
      setSelectedEntryIds(new Set());
      await Promise.all([loadData(), loadSummary()]);
    }
    return res;
  }

  async function batchReject(reason: string) {
    if (selectedEntryIds.size === 0 || !reason.trim()) return;
    const res = await fetch("/api/time-entries/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryIds: Array.from(selectedEntryIds),
        reason: reason.trim(),
      }),
    });
    if (res.ok) {
      setSelectedEntryIds(new Set());
      await Promise.all([loadData(), loadSummary()]);
    }
    return res;
  }

  // ─── CSV Export ────────────────────────────────────────────────────────────

  function exportCSV() {
    if (!data) return;

    const headers = ["成員", "日期", "時數", "分類", "加班類型", "審核狀態", "任務", "說明"];
    const rows: string[][] = [];

    for (const member of data.members) {
      for (const [date, day] of Object.entries(member.days)) {
        for (const entry of day.entries) {
          rows.push([
            member.name,
            date,
            String(entry.hours),
            entry.category,
            entry.overtimeType || "NONE",
            entry.approvalStatus,
            entry.task?.title || "",
            entry.description || "",
          ]);
        }
      }
    }

    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");

    // BOM for Excel compatibility with Chinese characters
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `工時月報_${data.month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return {
    // Month
    month,
    prevMonth,
    nextMonth,
    goToThisMonth,

    // Data
    data,
    summary,
    loading,
    summaryLoading,
    error,
    refresh: () => { loadData(); loadSummary(); },

    // Selection
    selectedEntryIds,
    statusFilter,
    setStatusFilter: setStatusFilter as (f: StatusFilter) => void,
    toggleMemberSelection,
    toggleEntrySelection,
    selectAll,
    clearSelection,
    filteredCount,

    // Expanded cell
    expandedCell,
    setExpandedCell,

    // Actions
    batchApprove,
    batchReject,
    exportCSV,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
