"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Target, Plus, Unlink, ChevronDown, ChevronRight } from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";
import { FormError, FormBanner } from "@/app/components/form-error";

// ── Types ──────────────────────────────────────────────────────────────────

interface KPITaskLink {
  taskId: string;
  weight: number;
  task: {
    id: string;
    title: string;
    status: string;
    progressPct: number;
    primaryAssignee?: { id: string; name: string } | null;
  };
}

interface KPI {
  id: string;
  year: number;
  code: string;
  title: string;
  description?: string | null;
  target: number;
  actual: number;
  weight: number;
  status: string;
  autoCalc: boolean;
  taskLinks: KPITaskLink[];
  creator?: { id: string; name: string } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function achievementRate(kpi: KPI): number {
  if (kpi.autoCalc && kpi.taskLinks.length > 0) {
    const totalWeight = kpi.taskLinks.reduce((s, l) => s + l.weight, 0);
    const weighted = kpi.taskLinks.reduce((s, l) => {
      const prog = l.task.status === "DONE" ? 100 : l.task.progressPct;
      return s + (prog * l.weight) / 100;
    }, 0);
    return totalWeight > 0
      ? Math.min((weighted / totalWeight) * kpi.target, 100)
      : 0;
  }
  return kpi.target > 0 ? Math.min((kpi.actual / kpi.target) * 100, 100) : 0;
}

function ProgressBar({ pct, color = "bg-primary" }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  ON_TRACK: "進行中",
  AT_RISK: "風險",
  BEHIND: "落後",
  ACHIEVED: "達成",
};
const STATUS_COLOR: Record<string, string> = {
  ON_TRACK: "text-green-400 bg-green-500/10",
  AT_RISK: "text-yellow-400 bg-yellow-500/10",
  BEHIND: "text-red-400 bg-red-500/10",
  ACHIEVED: "text-blue-400 bg-blue-500/10",
};
const TASK_STATUS_LABEL: Record<string, string> = {
  TODO: "待辦",
  IN_PROGRESS: "進行中",
  DONE: "完成",
  BLOCKED: "封鎖",
};

// ── Zod schema for KPI form ─────────────────────────────────────────────────

const createKpiFormSchema = z.object({
  year: z.number().int().min(2000, "年度不得早於 2000").max(2100, "年度不得晚於 2100"),
  code: z.string().min(1, "代碼為必填"),
  title: z.string().min(1, "名稱為必填"),
  description: z.string().optional(),
  target: z.number().nonnegative("目標值不得為負數"),
  weight: z.number().positive("權重必須大於 0"),
  autoCalc: z.boolean(),
});

type KpiFormErrors = Partial<Record<keyof z.infer<typeof createKpiFormSchema>, string>>;

// ── Create KPI Form ────────────────────────────────────────────────────────

interface CreateFormProps {
  onCreated: (kpi: KPI) => void;
  onCancel: () => void;
}

function CreateKPIForm({ onCreated, onCancel }: CreateFormProps) {
  const year = new Date().getFullYear();
  const [form, setForm] = useState({
    year: String(year),
    code: "",
    title: "",
    description: "",
    target: "",
    weight: "1",
    autoCalc: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [bannerError, setBannerError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<KpiFormErrors>({});

  function validate(): z.infer<typeof createKpiFormSchema> | null {
    const result = createKpiFormSchema.safeParse({
      year: parseInt(form.year) || 0,
      code: form.code,
      title: form.title,
      description: form.description || undefined,
      target: parseFloat(form.target),
      weight: parseFloat(form.weight),
      autoCalc: form.autoCalc,
    });
    if (!result.success) {
      const errs: KpiFormErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof KpiFormErrors;
        if (field && !errs[field]) errs[field] = issue.message;
      }
      setFieldErrors(errs);
      return null;
    }
    setFieldErrors({});
    return result.data;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = validate();
    if (!parsed) return;
    setSubmitting(true);
    setBannerError("");
    try {
      const res = await fetch("/api/kpi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) {
        const data = await res.json();
        setBannerError(data.error ?? "建立失敗");
        return;
      }
      const kpi = await res.json();
      onCreated(kpi);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-5 space-y-4">
      <h2 className="text-sm font-medium">新增 KPI</h2>
      <FormBanner message={bannerError} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">年度</label>
          <input
            type="number"
            value={form.year}
            onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
            className={cn("w-full bg-accent border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary",
              fieldErrors.year ? "border-red-500" : "border-border")}
          />
          <FormError message={fieldErrors.year} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">代碼 *</label>
          <input
            type="text"
            placeholder="如 KPI-01"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            className={cn("w-full bg-accent border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary",
              fieldErrors.code ? "border-red-500" : "border-border")}
          />
          <FormError message={fieldErrors.code} />
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-xs text-muted-foreground">名稱 *</label>
          <input
            type="text"
            placeholder="KPI 名稱"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className={cn("w-full bg-accent border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary",
              fieldErrors.title ? "border-red-500" : "border-border")}
          />
          <FormError message={fieldErrors.title} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">目標值 *</label>
          <input
            type="number"
            placeholder="100"
            value={form.target}
            onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
            className={cn("w-full bg-accent border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary",
              fieldErrors.target ? "border-red-500" : "border-border")}
          />
          <FormError message={fieldErrors.target} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">權重</label>
          <input
            type="number"
            step="0.1"
            value={form.weight}
            onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
            className={cn("w-full bg-accent border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary",
              fieldErrors.weight ? "border-red-500" : "border-border")}
          />
          <FormError message={fieldErrors.weight} />
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-xs text-muted-foreground">說明</label>
          <textarea
            placeholder="描述此 KPI..."
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full bg-accent border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input
            id="autoCalc"
            type="checkbox"
            checked={form.autoCalc}
            onChange={(e) => setForm((f) => ({ ...f, autoCalc: e.target.checked }))}
            className="rounded"
          />
          <label htmlFor="autoCalc" className="text-xs text-muted-foreground">
            自動從連結任務計算進度
          </label>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting ? "建立中..." : "建立 KPI"}
        </button>
      </div>
    </form>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────

interface KPICardProps {
  kpi: KPI;
  isManager: boolean;
  onUnlink: (kpiId: string, taskId: string) => Promise<void>;
  onRefresh: () => void;
}

function KPICard({ kpi, isManager, onUnlink, onRefresh }: KPICardProps) {
  const [expanded, setExpanded] = useState(false);
  const rate = achievementRate(kpi);

  const barColor =
    rate >= 100
      ? "bg-green-500"
      : rate >= 60
      ? "bg-primary"
      : rate >= 30
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-4 hover:bg-accent/40 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {expanded ? (
              <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">{kpi.code}</span>
                {kpi.status && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                      STATUS_COLOR[kpi.status] ?? "text-muted-foreground bg-accent"
                    )}
                  >
                    {STATUS_LABEL[kpi.status] ?? kpi.status}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-foreground mt-0.5">{kpi.title}</p>
              {kpi.description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{kpi.description}</p>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-semibold tabular-nums">{rate.toFixed(0)}%</p>
            <p className="text-[10px] text-muted-foreground tabular-nums">
              {kpi.actual} / {kpi.target}
            </p>
          </div>
        </div>
        <div className="mt-3 px-6">
          <ProgressBar pct={rate} color={barColor} />
        </div>
        <div className="mt-2 px-6 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>連結任務 {kpi.taskLinks.length} 項</span>
          <span>權重 {kpi.weight}</span>
        </div>
      </button>

      {/* Expanded: linked tasks */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">連結任務</p>
          {kpi.taskLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚未連結任務</p>
          ) : (
            kpi.taskLinks.map((link) => (
              <div
                key={link.taskId}
                className="flex items-center gap-3 p-2.5 bg-accent/40 rounded-md"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{link.task.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {TASK_STATUS_LABEL[link.task.status] ?? link.task.status}
                    </span>
                    {link.task.primaryAssignee && (
                      <span className="text-[10px] text-muted-foreground">
                        {link.task.primaryAssignee.name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-xs tabular-nums font-medium">
                      {link.task.status === "DONE" ? 100 : link.task.progressPct}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">w:{link.weight}</p>
                  </div>
                  {isManager && (
                    <button
                      onClick={() => onUnlink(kpi.id, link.taskId)}
                      className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="移除連結"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function KPIPage() {
  const { data: session } = useSession();
  const isManager = session?.user?.role === "MANAGER";

  const [kpis, setKpis] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const year = new Date().getFullYear();

  async function fetchKPIs() {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/kpi?year=${year}`);
      if (!res.ok) throw new Error("KPI 載入失敗");
      const data = await res.json();
      setKpis(Array.isArray(data) ? data : []);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchKPIs();
  }, []);

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

  function handleCreated(kpi: KPI) {
    setKpis((prev) => [...prev, { ...kpi, taskLinks: [] }]);
    setShowForm(false);
  }

  const avgRate =
    kpis.length > 0
      ? kpis.reduce((s, k) => s + achievementRate(k), 0) / kpis.length
      : 0;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.04em] flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            KPI 管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{year} 年度關鍵績效指標</p>
        </div>
        {isManager && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            新增 KPI
          </button>
        )}
      </div>

      {/* Summary */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <p className="text-2xl font-semibold tabular-nums">{kpis.length}</p>
            <p className="text-xs text-muted-foreground mt-1">KPI 總數</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <p className="text-2xl font-semibold tabular-nums text-green-400">
              {kpis.filter((k) => achievementRate(k) >= 100).length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">已達成</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <p className="text-2xl font-semibold tabular-nums">{avgRate.toFixed(0)}%</p>
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
      ) : kpis.length === 0 ? (
        <PageEmpty
          icon={<Target className="h-10 w-10" />}
          title="尚無 KPI"
          description={isManager ? "請點擊「新增 KPI」建立" : "請聯絡主管建立 KPI"}
        />
      ) : (
        <div className="space-y-3">
          {kpis.map((kpi) => (
            <KPICard
              key={kpi.id}
              kpi={kpi}
              isManager={isManager}
              onUnlink={handleUnlink}
              onRefresh={fetchKPIs}
            />
          ))}
        </div>
      )}
    </div>
  );
}
