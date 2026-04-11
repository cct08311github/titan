"use client";

import { useState } from "react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";
import { FormError, FormBanner } from "@/app/components/form-error";
import { type KPI, type KpiFormErrors } from "./kpi-types";

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

export interface CreateKPIFormProps {
  onCreated: (kpi: KPI) => void;
  onCancel: () => void;
}

export function CreateKPIForm({ onCreated, onCancel }: CreateKPIFormProps) {
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
