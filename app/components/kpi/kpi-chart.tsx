"use client";

import { useState, useEffect } from "react";
import { TrendingUp, X } from "lucide-react";
import { extractData } from "@/lib/api-client";
import { type KpiHistory } from "./kpi-types";

export interface TrendChartProps {
  kpiId: string;
  kpiUnit?: string | null;
  target: number;
  onClose: () => void;
}

export function TrendChart({ kpiId, kpiUnit, target, onClose }: TrendChartProps) {
  const [history, setHistory] = useState<KpiHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/kpi/${kpiId}/history`, { credentials: "include" });
        if (!res.ok) throw new Error("載入歷史失敗");
        const body = await res.json();
        const data = extractData<KpiHistory[]>(body);
        setHistory(Array.isArray(data) ? data : []);
      } catch {
        setError("無法載入歷史資料");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [kpiId]);

  const maxVal = history.length > 0
    ? Math.max(...history.map((h) => h.actual), target)
    : target || 1;

  const chartWidth = 400;
  const chartHeight = 140;
  const padLeft = 40;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 30;
  const innerW = chartWidth - padLeft - padRight;
  const innerH = chartHeight - padTop - padBottom;

  const points = history.map((h, i) => {
    const x = padLeft + (history.length > 1 ? (i / (history.length - 1)) * innerW : innerW / 2);
    const y = padTop + innerH - (h.actual / maxVal) * innerH;
    return { x, y, ...h };
  });

  const targetY = padTop + innerH - (target / maxVal) * innerH;
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="mt-3 border border-border rounded-lg p-4 bg-accent/20 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" />
          歷史趨勢
        </h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-accent transition-colors">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">載入中...</p>
      ) : error ? (
        <p className="text-sm text-danger py-4 text-center">{error}</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">尚無歷史記錄</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <svg width={chartWidth} height={chartHeight} className="text-muted-foreground">
              {/* Y axis */}
              <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + innerH} stroke="currentColor" strokeWidth={0.5} />
              {/* X axis */}
              <line x1={padLeft} y1={padTop + innerH} x2={padLeft + innerW} y2={padTop + innerH} stroke="currentColor" strokeWidth={0.5} />
              {/* Target line */}
              <line
                x1={padLeft} y1={targetY}
                x2={padLeft + innerW} y2={targetY}
                stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 2"
              />
              <text x={padLeft + innerW - 2} y={targetY - 3} fontSize={9} fill="#f59e0b" textAnchor="end">目標 {target}</text>
              {/* Polyline */}
              {points.length > 1 && (
                <polyline
                  points={polyline}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {/* Dots */}
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} fill="hsl(var(--primary))" />
              ))}
              {/* X labels */}
              {points.map((p, i) => (
                <text key={i} x={p.x} y={padTop + innerH + 16} fontSize={9} fill="currentColor" textAnchor="middle">
                  {p.period.length > 7 ? p.period.slice(2) : p.period}
                </text>
              ))}
              {/* Y labels */}
              <text x={padLeft - 3} y={padTop + 6} fontSize={9} fill="currentColor" textAnchor="end">{Math.round(maxVal)}</text>
              <text x={padLeft - 3} y={padTop + innerH} fontSize={9} fill="currentColor" textAnchor="end">0</text>
            </svg>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1 text-muted-foreground font-normal">期間</th>
                  <th className="text-right py-1 text-muted-foreground font-normal">達成值{kpiUnit ? ` (${kpiUnit})` : ""}</th>
                  <th className="text-left py-1 pl-4 text-muted-foreground font-normal">備註</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1 tabular-nums">{h.period}</td>
                    <td className="py-1 text-right tabular-nums font-medium">{h.actual}</td>
                    <td className="py-1 pl-4 text-muted-foreground">{h.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
