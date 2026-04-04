"use client";

import { useState } from "react";
import { BarChart3, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";

type RetroData = {
  month: string;
  completedTaskCount: number;
  totalHoursLogged: number;
  teamSize: number;
  categoryBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  topContributors: { name: string; count: number }[];
  timeByUser: { name: string; totalHours: number }[];
  recentCompletions: { id: string; title: string; assignee: string; completedAt: string }[];
};

function getPreviousMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const inputCls =
  "bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors placeholder:text-muted-foreground";

export function RetrospectiveGenerator() {
  const [expanded, setExpanded] = useState(false);
  const [month, setMonth] = useState(getPreviousMonth);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RetroData | null>(null);
  const [error, setError] = useState("");

  async function generate() {
    if (!month) return;
    setLoading(true);
    setError("");
    setData(null);
    try {
      const res = await fetch(`/api/retrospective/generate?month=${encodeURIComponent(month)}`);
      if (res.ok) {
        const body = await res.json();
        const retro = extractData<RetroData>(body);
        if (retro) setData(retro);
      } else {
        const errBody = await res.json().catch(() => ({}));
        setError(errBody?.message ?? errBody?.error ?? "產生失敗，請再試一次");
      }
    } finally {
      setLoading(false);
    }
  }

  const maxCategory = data
    ? Math.max(1, ...Object.values(data.categoryBreakdown))
    : 1;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header / Toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">月度回顧報告</span>
        </div>
        <ChevronRight
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            expanded && "rotate-90"
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pb-5 pt-4 space-y-5">
          {/* Controls */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">選擇月份</label>
              <input
                type="month"
                value={month}
                onChange={(e) => { setMonth(e.target.value); setData(null); setError(""); }}
                className={inputCls}
              />
            </div>
            <button
              onClick={generate}
              disabled={loading || !month}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <BarChart3 className="h-3.5 w-3.5" />
              )}
              產生報告
            </button>
          </div>

          {error && (
            <p className="text-xs text-rose-400">{error}</p>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>正在產生回顧報告…</span>
            </div>
          )}

          {data && !loading && (
            <div className="space-y-6">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "完成任務", value: data.completedTaskCount, unit: "件" },
                  { label: "工時合計", value: data.totalHoursLogged.toFixed(1), unit: "h" },
                  { label: "團隊人數", value: data.teamSize, unit: "人" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-background border border-border rounded-lg px-3 py-3 text-center"
                  >
                    <div className="text-xl font-bold text-foreground">
                      {stat.value}
                      <span className="text-xs font-normal text-muted-foreground ml-0.5">{stat.unit}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Category breakdown */}
              {Object.keys(data.categoryBreakdown).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    類別分佈
                  </h3>
                  <div className="space-y-1.5">
                    {Object.entries(data.categoryBreakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cat, count]) => (
                        <div key={cat} className="flex items-center gap-2">
                          <span className="w-24 text-xs text-foreground truncate shrink-0">{cat}</span>
                          <div className="flex-1 bg-border rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${(count / maxCategory) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-6 text-right shrink-0">
                            {count}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Top contributors */}
              {data.topContributors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    主要貢獻者（前 5）
                  </h3>
                  <div className="bg-background border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left px-3 py-2 font-medium">名稱</th>
                          <th className="text-right px-3 py-2 font-medium">完成數</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topContributors.slice(0, 5).map((c, i) => (
                          <tr key={i} className={cn(i !== 0 && "border-t border-border")}>
                            <td className="px-3 py-2 text-foreground">{c.name}</td>
                            <td className="px-3 py-2 text-right text-foreground font-medium">{c.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recent completions */}
              {data.recentCompletions.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    最近完成任務（最多 10 筆）
                  </h3>
                  <div className="space-y-1.5">
                    {data.recentCompletions.slice(0, 10).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-start justify-between gap-2 text-xs bg-background border border-border rounded-md px-3 py-2"
                      >
                        <span className="text-foreground line-clamp-1 flex-1">{t.title}</span>
                        <span className="text-muted-foreground shrink-0">{t.assignee}</span>
                        <span className="text-muted-foreground shrink-0">
                          {new Date(t.completedAt).toLocaleDateString("zh-TW")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
