"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Target, Plus, Unlink, ChevronDown, ChevronRight, Search, Filter } from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";
import { FormError, FormBanner } from "@/app/components/form-error";
import { safePct } from "@/lib/safe-number";
import { calculateAchievement } from "@/lib/kpi-calculator";

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
  measureMethod?: string | null;
  target: number;
  actual: number;
  weight: number;
  frequency: string;
  minValue?: number | null;
  maxValue?: number | null;
  unit?: string | null;
  visibility: string;
  status: string;
  autoCalc: boolean;
  taskLinks: KPITaskLink[];
  creator?: { id: string; name: string } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function achievementRate(kpi: KPI): number {
  return calculateAchievement(kpi);
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
  DRAFT: "草稿",
  ACTIVE: "啟用",
  ACHIEVED: "達成",
  MISSED: "未達",
  CANCELLED: "停用",
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT: "text-muted-foreground bg-muted",
  ACTIVE: "text-success bg-success/10",
  ACHIEVED: "text-blue-400 bg-blue-500/10",
  MISSED: "text-danger bg-danger/10",
  CANCELLED: "text-muted-foreground bg-muted/50",
};
const FREQUENCY_LABEL: Record<string, string> = {
  MONTHLY: "月報",
  QUARTERLY: "季報",
  YEARLY: "年報",
};
const VISIBILITY_LABEL: Record<string, string> = {
  ALL: "全員可見",
  MANAGER: "僅管理者",
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
  measureMethod: z.string().optional(),
  target: z.number().nonnegative("目標值不得為負數"),
  weight: z.number().min(0, "權重不得為負").max(100, "權重不得超過 100"),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  unit: z.string().optional(),
  visibility: z.enum(["ALL", "MANAGER"]),
  autoCalc: z.boolean(),
});

type KpiFormErrors = Partial<Record<string, string>>;

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
    measureMethod: "",
    target: "",
    weight: "1",
    frequency: "MONTHLY",
    minValue: "",
    maxValue: "",
    unit: "",
    visibility: "ALL",
    autoCalc: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [bannerError, setBannerError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<KpiFormErrors>({});

  function validate() {
    const result = createKpiFormSchema.safeParse({
      year: parseInt(form.year) || 0,
      code: form.code,
      title: form.title,
      description: form.description || undefined,
      measureMethod: form.measureMethod || undefined,
      target: parseFloat(form.target),
      weight: parseFloat(form.weight),
      frequency: form.frequency,
      minValue: form.minValue ? parseFloat(form.minValue) : undefined,
      maxValue: form.maxValue ? parseFloat(form.maxValue) : undefined,
      unit: form.unit || undefined,
      visibility: form.visibility,
      autoCalc: form.autoCalc,
    });
    if (!result.success) {
      const errs: KpiFormErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
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
        const errBody = await res.json().catch(() => ({}));
        setBannerError(errBody?.message ?? errBody?.error ?? "建立失敗");
        return;
      }
      const body = await res.json();
      const kpi = extractData<KPI>(body);
      onCreated(kpi);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl shadow-card p-5 space-y-4">
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
        <div className="col-span-2 space-y-1">
          <label className="text-xs text-muted-foreground">衡量方式</label>
          <input
            type="text"
            placeholder="如：每月客訴件數"
            value={form.measureMethod}
            onChange={(e) => setForm((f) => ({ ...f, measureMethod: e.target.value }))}
            className="w-full bg-accent border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
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
          <label className="text-xs text-muted-foreground">權重 (%)</label>
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
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">最小值</label>
          <input
            type="number"
            placeholder="0"
            value={form.minValue}
            onChange={(e) => setForm((f) => ({ ...f, minValue: e.target.value }))}
            className={cn("w-full bg-accent border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary",
              fieldErrors.minValue ? "border-red-500" : "border-border")}
          />
          <FormError message={fieldErrors.minValue} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">最大值</label>
          <input
            type="number"
            placeholder="100"
            value={form.maxValue}
            onChange={(e) => setForm((f) => ({ ...f, maxValue: e.target.value }))}
            className={cn("w-full bg-accent border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary",
              fieldErrors.maxValue ? "border-red-500" : "border-border")}
          />
          <FormError message={fieldErrors.maxValue} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">單位</label>
          <input
            type="text"
            placeholder="如 %、次、小時"
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            className="w-full bg-accent border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">填報頻率</label>
          <select
            value={form.frequency}
            onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
            className="w-full bg-accent border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="MONTHLY">月報</option>
            <option value="QUARTERLY">季報</option>
            <option value="YEARLY">年報</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">可視權限</label>
          <select
            value={form.visibility}
            onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))}
            className="w-full bg-accent border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">全員可見</option>
            <option value="MANAGER">僅 Manager + Admin</option>
          </select>
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
  onStatusChange: (kpiId: string, newStatus: string) => Promise<void>;
}

function KPICard({ kpi, isManager, onUnlink, onStatusChange }: KPICardProps) {
  const [expanded, setExpanded] = useState(false);
  const rate = achievementRate(kpi);

  const barColor =
    rate >= 100
      ? "bg-success"
      : rate >= 60
      ? "bg-primary"
      : rate >= 30
      ? "bg-warning"
      : "bg-danger";

  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground">{kpi.code}</span>
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    STATUS_COLOR[kpi.status] ?? "text-muted-foreground bg-accent"
                  )}
                >
                  {STATUS_LABEL[kpi.status] ?? kpi.status}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {FREQUENCY_LABEL[kpi.frequency] ?? kpi.frequency}
                </span>
                {kpi.visibility === "MANAGER" && (
                  <span className="text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                    {VISIBILITY_LABEL.MANAGER}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-foreground mt-0.5">{kpi.title}</p>
              {kpi.measureMethod && (
                <p className="text-xs text-muted-foreground mt-0.5">衡量: {kpi.measureMethod}</p>
              )}
              {kpi.description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{kpi.description}</p>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-semibold tabular-nums">{safePct(rate, 0)}%</p>
            <p className="text-[10px] text-muted-foreground tabular-nums">
              {kpi.actual} / {kpi.target}{kpi.unit ? ` ${kpi.unit}` : ""}
            </p>
          </div>
        </div>
        <div className="mt-3 px-6">
          <ProgressBar pct={rate} color={barColor} />
        </div>
        <div className="mt-2 px-6 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>連結任務 {kpi.taskLinks.length} 項</span>
          <span>權重 {kpi.weight}%</span>
          {kpi.minValue != null && kpi.maxValue != null && (
            <span>值域 {kpi.minValue}–{kpi.maxValue}{kpi.unit || ""}</span>
          )}
        </div>
      </button>

      {/* Expanded: linked tasks + status actions */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
          {/* Status actions for Manager */}
          {isManager && (
            <div className="flex gap-2 mb-3">
              {kpi.status === "DRAFT" && (
                <button
                  onClick={() => onStatusChange(kpi.id, "ACTIVE")}
                  className="text-xs px-3 py-1 bg-success/10 text-success rounded-md hover:bg-success/20 transition-colors"
                >
                  啟用
                </button>
              )}
              {kpi.status === "ACTIVE" && (
                <button
                  onClick={() => onStatusChange(kpi.id, "CANCELLED")}
                  className="text-xs px-3 py-1 bg-danger/10 text-danger rounded-md hover:bg-danger/20 transition-colors"
                >
                  停用
                </button>
              )}
            </div>
          )}

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
                      className="p-1 rounded text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
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
  const isManager = session?.user?.role === "MANAGER" || session?.user?.role === "ADMIN";

  const [kpis, setKpis] = useState<KPI[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [frequencyFilter, setFrequencyFilter] = useState("");
  const year = new Date().getFullYear();

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

  const avgRate =
    kpis.length > 0
      ? kpis.reduce((s, k) => s + achievementRate(k), 0) / kpis.length
      : 0;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
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

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜尋 KPI 名稱或代碼..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-accent border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-accent border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">全部狀態</option>
            <option value="DRAFT">草稿</option>
            <option value="ACTIVE">啟用</option>
            <option value="ACHIEVED">達成</option>
            <option value="MISSED">未達</option>
            <option value="CANCELLED">停用</option>
          </select>
          <select
            value={frequencyFilter}
            onChange={(e) => setFrequencyFilter(e.target.value)}
            className="bg-accent border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">全部頻率</option>
            <option value="MONTHLY">月報</option>
            <option value="QUARTERLY">季報</option>
            <option value="YEARLY">年報</option>
          </select>
        </div>
      </div>

      {/* Summary */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-xl shadow-card p-4 text-center">
            <p className="text-2xl font-semibold tabular-nums">{total}</p>
            <p className="text-xs text-muted-foreground mt-1">KPI 總數</p>
          </div>
          <div className="bg-card rounded-xl shadow-card p-4 text-center">
            <p className="text-2xl font-semibold tabular-nums text-success">
              {kpis.filter((k) => achievementRate(k) >= 100).length}
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
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
