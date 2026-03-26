"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { BarChart2, ChevronLeft, ChevronRight } from "lucide-react";
import { extractData } from "@/lib/api-client";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";
import { KPIDashboardCard } from "./kpi-dashboard-card";
import { calculateAchievement } from "@/lib/kpi-calculator";

interface KPIAchievement {
  id: string;
  period: string;
  actualValue: number;
}

interface DashboardKPI {
  id: string;
  code: string;
  title: string;
  target: number;
  actual: number;
  weight: number;
  unit?: string | null;
  status: string;
  frequency: string;
  autoCalc: boolean;
  taskLinks: { weight: number; task: { status: string; progressPct: number } }[];
  achievements?: KPIAchievement[];
}

const PAGE_SIZE = 9;

/**
 * KPI 儀表板 — 以卡片 + ECharts 圖表顯示 KPI 達成狀態
 * 支援分頁，每頁 9 個 KPI
 */
export function KPIDashboard() {
  const { data: session } = useSession();
  const [kpis, setKpis] = useState<DashboardKPI[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const year = new Date().getFullYear();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({
        year: String(year),
        include: "latestAchievement",
        page: String(page),
        limit: String(PAGE_SIZE),
        status: "ACTIVE",
      });
      const res = await fetch(`/api/kpi?${params}`);
      if (!res.ok) throw new Error("KPI 儀表板載入失敗");
      const body = await res.json();
      const data = extractData<{ items: DashboardKPI[]; total: number }>(body);
      setKpis(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [year, page]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Summary stats
  const rates = kpis.map((k) => {
    const hasAchievement = k.achievements && k.achievements.length > 0;
    return hasAchievement ? calculateAchievement(k) : -1; // -1 = no data
  });
  const withData = rates.filter((r) => r >= 0);
  const greenCount = withData.filter((r) => r >= 90).length;
  const yellowCount = withData.filter((r) => r >= 60 && r < 90).length;
  const redCount = withData.filter((r) => r < 60).length;
  const avgRate = withData.length > 0 ? withData.reduce((s, r) => s + r, 0) / withData.length : 0;

  return (
    <div>
      {/* Summary bar */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-card rounded-xl shadow-card p-3 text-center">
            <p className="text-xl font-semibold tabular-nums">{total}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">啟用中</p>
          </div>
          <div className="bg-card rounded-xl shadow-card p-3 text-center">
            <p className="text-xl font-semibold tabular-nums text-green-500">{greenCount}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">達標 (&ge;90%)</p>
          </div>
          <div className="bg-card rounded-xl shadow-card p-3 text-center">
            <p className="text-xl font-semibold tabular-nums text-yellow-500">{yellowCount}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">注意 (60-89%)</p>
          </div>
          <div className="bg-card rounded-xl shadow-card p-3 text-center">
            <p className="text-xl font-semibold tabular-nums text-red-500">{redCount}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">警告 (&lt;60%)</p>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      {loading ? (
        <PageLoading message="載入 KPI 儀表板..." />
      ) : fetchError ? (
        <PageError message={fetchError} onRetry={fetchDashboard} />
      ) : kpis.length === 0 ? (
        <PageEmpty
          icon={<BarChart2 className="h-10 w-10" />}
          title="尚無啟用中的 KPI"
          description="請先在 KPI 管理頁面建立並啟用 KPI"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpis.map((kpi, idx) => {
              const hasAchievement = kpi.achievements && kpi.achievements.length > 0;
              const rate = hasAchievement ? calculateAchievement(kpi) : 0;
              return (
                <KPIDashboardCard
                  key={kpi.id}
                  kpi={kpi}
                  achievementRate={rate}
                />
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-md hover:bg-accent disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-muted-foreground tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-md hover:bg-accent disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
