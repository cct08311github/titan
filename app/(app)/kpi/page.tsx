"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Target, Plus, Copy, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";
import { safePct } from "@/lib/safe-number";
import { calculateAchievement } from "@/lib/kpi-calculator";
import { KPICard } from "@/app/components/kpi/kpi-card";
import { KpiFilters } from "@/app/components/kpi/kpi-filters";
import { CreateKPIForm } from "@/app/components/kpi/kpi-form-modal";
import { type KPI } from "@/app/components/kpi/kpi-types";

// ── Toast ──────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2",
        type === "success" ? "bg-success text-white" : "bg-danger text-white"
      )}
    >
      {type === "success" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      {message}
    </div>
  );
}

// ── Copy Year Confirmation Dialog ──────────────────────────────────────────

interface CopyYearDialogProps {
  year: number;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

function CopyYearDialog({ year, onConfirm, onClose }: CopyYearDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-xl shadow-lg w-full max-w-sm p-5 space-y-4">
        <h3 className="text-sm font-medium">複製至下年</h3>
        <p className="text-sm text-muted-foreground">
          確定將 <strong>{year}</strong> 年度的 KPI 複製到 <strong>{year + 1}</strong> 年度？
        </p>
        <p className="text-xs text-muted-foreground">
          複製後新 KPI 將以草稿狀態建立，達成值不會被複製。
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? "複製中..." : "確認複製"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function KPIPage() {
  const { data: session } = useSession();
  const isManager = session?.user?.role === "MANAGER" || session?.user?.role === "ADMIN";
  const currentUserId = session?.user?.id;

  const [kpis, setKpis] = useState<KPI[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showCopyYear, setShowCopyYear] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [frequencyFilter, setFrequencyFilter] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const year = new Date().getFullYear();

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  const fetchKPIs = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({ year: String(year) });
      if (statusFilter) params.set("status", statusFilter);
      if (frequencyFilter) params.set("frequency", frequencyFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      const res = await fetch(`/api/kpi?${params}`);
      if (!res.ok) throw new Error("KPI 載入失敗");
      const body = await res.json();
      const data = extractData<{ items: KPI[]; total: number }>(body);
      setKpis(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [year, statusFilter, frequencyFilter, searchQuery]);

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  async function handleUnlink(kpiId: string, taskId: string) {
    const res = await fetch(`/api/kpi/${kpiId}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, remove: true }),
    });
    if (res.ok) {
      setKpis((prev) =>
        prev.map((k) =>
          k.id === kpiId
            ? { ...k, taskLinks: k.taskLinks.filter((l) => l.taskId !== taskId) }
            : k
        )
      );
    }
  }

  async function handleStatusChange(kpiId: string, newStatus: string) {
    const res = await fetch(`/api/kpi/${kpiId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setKpis((prev) =>
        prev.map((k) => (k.id === kpiId ? { ...k, status: newStatus } : k))
      );
    }
  }

  function handleCreated(kpi: KPI) {
    setKpis((prev) => [...prev, { ...kpi, taskLinks: [] }]);
    setTotal((t) => t + 1);
    setShowForm(false);
  }

  function handleKpiUpdated(updated: KPI) {
    setKpis((prev) => prev.map((k) => (k.id === updated.id ? { ...k, ...updated } : k)));
  }

  async function handleCopyYear() {
    const res = await fetch("/api/kpi/copy-year", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sourceYear: year, targetYear: year + 1 }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      showToast(errBody?.message ?? errBody?.error ?? "複製失敗", "error");
      setShowCopyYear(false);
      return;
    }
    showToast(`已將 ${year} 年度 KPI 複製至 ${year + 1} 年度`, "success");
    setShowCopyYear(false);
  }

  // Client-side instant filter — useMemo avoids recomputing on unrelated renders
  const filteredKpis = useMemo(() => {
    if (!searchQuery.trim()) return kpis;
    const q = searchQuery.trim().toLowerCase();
    return kpis.filter((k) =>
      k.title.toLowerCase().includes(q) ||
      k.code.toLowerCase().includes(q) ||
      (k.description ?? "").toLowerCase().includes(q)
    );
  }, [kpis, searchQuery]);

  const avgRate = useMemo(
    () =>
      filteredKpis.length > 0
        ? filteredKpis.reduce((s, k) => s + calculateAchievement(k), 0) / filteredKpis.length
        : 0,
    [filteredKpis]
  );

  return (
    <div className="max-w-3xl mx-auto">
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Copy Year Confirmation Dialog */}
      {showCopyYear && (
        <CopyYearDialog
          year={year}
          onConfirm={handleCopyYear}
          onClose={() => setShowCopyYear(false)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight flex items-center gap-2">
            <Target className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            KPI 管理
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{year} 年度關鍵績效指標</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isManager && (
            <button
              onClick={() => setShowCopyYear(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-accent text-muted-foreground text-sm rounded-md hover:bg-accent/70 hover:text-foreground transition-colors"
            >
              <Copy className="h-4 w-4" />
              複製至下年
            </button>
          )}
          {isManager && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              新增 KPI
            </button>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <KpiFilters
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        frequencyFilter={frequencyFilter}
        onSearchChange={setSearchQuery}
        onStatusChange={setStatusFilter}
        onFrequencyChange={setFrequencyFilter}
      />

      {/* Summary */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
          <div className="bg-card rounded-xl shadow-card p-4 text-center">
            <p className="text-2xl font-semibold tabular-nums">{total}</p>
            <p className="text-xs text-muted-foreground mt-1">KPI 總數</p>
          </div>
          <div className="bg-card rounded-xl shadow-card p-4 text-center">
            <p className="text-2xl font-semibold tabular-nums text-success">
              {kpis.filter((k) => calculateAchievement(k) >= 100).length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">已達成</p>
          </div>
          <div className="bg-card rounded-xl shadow-card p-4 text-center">
            <p className="text-2xl font-semibold tabular-nums">{safePct(avgRate, 0)}%</p>
            <p className="text-xs text-muted-foreground mt-1">平均達成率</p>
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="mb-6">
          <CreateKPIForm onCreated={handleCreated} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* KPI List */}
      {loading ? (
        <PageLoading message="載入 KPI..." />
      ) : fetchError ? (
        <PageError message={fetchError} onRetry={fetchKPIs} />
      ) : filteredKpis.length === 0 ? (
        <PageEmpty
          icon={<Target className="h-10 w-10" />}
          title={searchQuery.trim() ? "無符合結果" : "尚無 KPI"}
          description={searchQuery.trim() ? `找不到包含「${searchQuery}」的 KPI` : isManager ? "請點擊「新增 KPI」建立" : "請聯絡主管建立 KPI"}
        />
      ) : (
        <div className="space-y-3">
          {filteredKpis.map((kpi) => (
            <KPICard
              key={kpi.id}
              kpi={kpi}
              isManager={isManager}
              currentUserId={currentUserId}
              onUnlink={handleUnlink}
              onRefresh={fetchKPIs}
              onStatusChange={handleStatusChange}
              onKpiUpdated={handleKpiUpdated}
              onToast={showToast}
            />
          ))}
        </div>
      )}
    </div>
  );
}
