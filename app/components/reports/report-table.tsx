"use client";

/**
 * HR-grade time report components — TimeSummaryReport + OvertimeReport
 * Extracted from reports/page.tsx (Issue #1161).
 */

import { useState, useEffect } from "react";
import { Loader2, Download } from "lucide-react";
import { PageError } from "@/app/components/page-states";
import { exportCSV } from "./report-charts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DateRangeProps {
  from: string;
  to: string;
}

interface TimeSummaryUser {
  userName: string;
  email: string;
  planned: number;
  added: number;
  incident: number;
  support: number;
  admin: number;
  learning: number;
  total: number;
  workdays: number;
  target: number;
  utilizationPct: number;
}

interface OvertimeUser {
  userName: string;
  email: string;
  normal: number;
  weekdayOT: number;
  holidayOT: number;
  totalOT: number;
  totalHours: number;
  otRatio: number;
  monthlyOTLimit: number;
  overLimit: boolean;
}

// ─── Time Summary Report ─────────────────────────────────────────────────────

export function TimeSummaryReport({ from, to }: DateRangeProps) {
  const [data, setData] = useState<TimeSummaryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/reports/time-summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&mode=by-user`)
      .then(r => { if (!r.ok) throw new Error("載入失敗"); return r.json(); })
      .then(d => setData(d.data?.users ?? d.data ?? []))
      .catch((e) => { setData([]); setError(e instanceof Error ? e.message : "載入失敗"); })
      .finally(() => setLoading(false));
  }, [from, to, reloadKey]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (error) return <PageError message={error} onRetry={() => setReloadKey(k => k + 1)} className="py-8" />;
  if (!data.length) return <div className="text-center text-muted-foreground py-12">此期間無工時資料<br /><span className="text-xs">團隊成員開始登記工時後，摘要將自動產生</span></div>;

  const totals = data.reduce(
    (acc, r) => ({
      planned: acc.planned + r.planned,
      added: acc.added + r.added,
      incident: acc.incident + r.incident,
      support: acc.support + r.support,
      admin: acc.admin + r.admin,
      learning: acc.learning + r.learning,
      total: acc.total + r.total,
      target: acc.target + r.target,
    }),
    { planned: 0, added: 0, incident: 0, support: 0, admin: 0, learning: 0, total: 0, target: 0 }
  );

  const handleExport = () => exportCSV(
    ["姓名", "Email", "計畫工時", "追加", "事件", "支援", "行政", "學習", "合計", "工作天", "目標(h)", "達成率(%)"],
    data.map(r => [r.userName, r.email, r.planned, r.added, r.incident, r.support, r.admin, r.learning, r.total, r.workdays, r.target, r.utilizationPct].map(String)),
    `time-summary-${from}-${to}.csv`
  );

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <div>
          <h3 className="font-semibold">工時摘要</h3>
          <p className="text-xs text-muted-foreground">按成員彙總各分類工時、目標達成率</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent">
          <Download className="h-3.5 w-3.5" />CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left py-2 px-2">姓名</th>
              <th className="text-right py-2 px-1" title="計畫任務">計畫</th>
              <th className="text-right py-2 px-1" title="追加任務">追加</th>
              <th className="text-right py-2 px-1" title="事件處理">事件</th>
              <th className="text-right py-2 px-1" title="用戶支援">支援</th>
              <th className="text-right py-2 px-1" title="行政庶務">行政</th>
              <th className="text-right py-2 px-1" title="學習成長">學習</th>
              <th className="text-right py-2 px-2 font-bold">合計</th>
              <th className="text-right py-2 px-1">工作天</th>
              <th className="text-right py-2 px-1">目標(h)</th>
              <th className="text-right py-2 px-2">達成率</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => {
              const pct = r.utilizationPct;
              const pctColor = pct >= 100 ? "text-green-600" : pct >= 80 ? "text-foreground" : pct >= 60 ? "text-amber-600" : "text-red-600";
              return (
                <tr key={r.email || r.userName || i} className="border-b border-border/30 hover:bg-accent/30">
                  <td className="py-1.5 px-2 font-medium">{r.userName}</td>
                  <td className="text-right py-1.5 px-1">{r.planned || "-"}</td>
                  <td className="text-right py-1.5 px-1">{r.added || "-"}</td>
                  <td className="text-right py-1.5 px-1">{r.incident || "-"}</td>
                  <td className="text-right py-1.5 px-1">{r.support || "-"}</td>
                  <td className="text-right py-1.5 px-1">{r.admin || "-"}</td>
                  <td className="text-right py-1.5 px-1">{r.learning || "-"}</td>
                  <td className="text-right py-1.5 px-2 font-bold">{r.total}h</td>
                  <td className="text-right py-1.5 px-1">{r.workdays}</td>
                  <td className="text-right py-1.5 px-1">{r.target}h</td>
                  <td className={`text-right py-1.5 px-2 font-bold ${pctColor}`}>{pct}%</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-bold bg-muted/20">
              <td className="py-2 px-2">全團隊</td>
              <td className="text-right py-2 px-1">{totals.planned}</td>
              <td className="text-right py-2 px-1">{totals.added}</td>
              <td className="text-right py-2 px-1">{totals.incident}</td>
              <td className="text-right py-2 px-1">{totals.support}</td>
              <td className="text-right py-2 px-1">{totals.admin}</td>
              <td className="text-right py-2 px-1">{totals.learning}</td>
              <td className="text-right py-2 px-2">{totals.total}h</td>
              <td className="text-right py-2 px-1" colSpan={2}>{totals.target}h</td>
              <td className="text-right py-2 px-2">{totals.target > 0 ? Math.round(totals.total / totals.target * 100) : 0}%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Overtime Report ─────────────────────────────────────────────────────────

export function OvertimeReport({ from, to }: DateRangeProps) {
  const [data, setData] = useState<OvertimeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/reports/overtime?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&mode=compliance`)
      .then(r => { if (!r.ok) throw new Error("載入失敗"); return r.json(); })
      .then(d => setData(d.data?.users ?? d.data ?? []))
      .catch((e) => { setData([]); setError(e instanceof Error ? e.message : "載入失敗"); })
      .finally(() => setLoading(false));
  }, [from, to, reloadKey]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (error) return <PageError message={error} onRetry={() => setReloadKey(k => k + 1)} className="py-8" />;
  if (!data.length) return <div className="text-center text-muted-foreground py-12">此期間無加班資料</div>;

  const overLimitCount = data.filter(r => r.overLimit).length;
  const totalOT = data.reduce((s, r) => s + r.totalOT, 0);

  const handleExport = () => exportCSV(
    ["姓名", "Email", "正常工時", "平日加班", "假日加班", "加班合計", "總工時", "加班佔比(%)", "月加班上限(h)", "超標"],
    data.map(r => [r.userName, r.email, r.normal, r.weekdayOT, r.holidayOT, r.totalOT, r.totalHours, r.otRatio, r.monthlyOTLimit, r.overLimit ? "是" : "否"].map(String)),
    `overtime-${from}-${to}.csv`
  );

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <div>
          <h3 className="font-semibold">加班分析</h3>
          <p className="text-xs text-muted-foreground">正常/平日加班/假日加班明細，含法規上限警示</p>
        </div>
        <button onClick={handleExport} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-md hover:bg-accent">
          <Download className="h-3.5 w-3.5" />CSV
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="border border-border rounded-lg p-3 text-center">
          <div className="text-lg font-bold">{totalOT}h</div>
          <div className="text-[10px] text-muted-foreground">團隊加班總計</div>
        </div>
        <div className="border border-border rounded-lg p-3 text-center">
          <div className="text-lg font-bold">{data.length > 0 ? Math.round(totalOT / data.length * 10) / 10 : 0}h</div>
          <div className="text-[10px] text-muted-foreground">人均加班</div>
        </div>
        <div className={`border rounded-lg p-3 text-center ${overLimitCount > 0 ? "border-red-500 bg-red-50 dark:bg-red-950/30" : "border-border"}`}>
          <div className={`text-lg font-bold ${overLimitCount > 0 ? "text-red-600" : ""}`}>{overLimitCount}</div>
          <div className="text-[10px] text-muted-foreground">超標人數</div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left py-2 px-2">姓名</th>
              <th className="text-right py-2 px-2">正常</th>
              <th className="text-right py-2 px-2">平日 OT</th>
              <th className="text-right py-2 px-2">假日 OT</th>
              <th className="text-right py-2 px-2 font-bold">OT 合計</th>
              <th className="text-right py-2 px-2">總工時</th>
              <th className="text-right py-2 px-2">OT 佔比</th>
              <th className="text-right py-2 px-2">月上限</th>
              <th className="text-center py-2 px-2">狀態</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={r.email || r.userName || i} className={`border-b border-border/30 hover:bg-accent/30 ${r.overLimit ? "bg-red-50/50 dark:bg-red-950/20" : ""}`}>
                <td className="py-1.5 px-2 font-medium">{r.userName}</td>
                <td className="text-right py-1.5 px-2">{r.normal}h</td>
                <td className="text-right py-1.5 px-2 text-amber-600 dark:text-amber-400">{r.weekdayOT}h</td>
                <td className="text-right py-1.5 px-2 text-red-600 dark:text-red-400">{r.holidayOT}h</td>
                <td className="text-right py-1.5 px-2 font-bold">{r.totalOT}h</td>
                <td className="text-right py-1.5 px-2">{r.totalHours}h</td>
                <td className="text-right py-1.5 px-2">{r.otRatio}%</td>
                <td className="text-right py-1.5 px-2">{r.monthlyOTLimit}h</td>
                <td className="text-center py-1.5 px-2">
                  {r.overLimit
                    ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 font-medium">超標</span>
                    : <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">正常</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
