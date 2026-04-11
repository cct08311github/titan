"use client";

import { useState } from "react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";
import { FormError, FormBanner } from "@/app/components/form-error";
import { type KPI, type KpiFormErrors } from "./kpi-types";

const editKpiFormSchema = z.object({
  title: z.string().min(1, "名稱為必填"),
  description: z.string().optional(),
  target: z.number().nonnegative("目標值不得為負數"),
  unit: z.string().optional(),
  weight: z.number().min(0, "權重不得為負").max(100, "權重不得超過 100"),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]),
  visibility: z.enum(["ALL", "MANAGER"]),
});

export interface EditKPIFormProps {
  kpi: KPI;
  onSaved: (updated: KPI) => void;
  onCancel: () => void;
}

export function EditKPIForm({ kpi, onSaved, onCancel }: EditKPIFormProps) {
  const [form, setForm] = useState({
    title: kpi.title,
    description: kpi.description ?? "",
    target: String(kpi.target),
    unit: kpi.unit ?? "",
    weight: String(kpi.weight),
    frequency: kpi.frequency,
    visibility: kpi.visibility,
  });
  const [submitting, setSubmitting] = useState(false);
  const [bannerError, setBannerError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<KpiFormErrors>({});

  function validate() {
    const result = editKpiFormSchema.safeParse({
      title: form.title,
      description: form.description || undefined,
      target: parseFloat(form.target),
      unit: form.unit || undefined,
      weight: parseFloat(form.weight),
      frequency: form.frequency,
      visibility: form.visibility,
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
      const res = await fetch(`/api/kpi/${kpi.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(parsed),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setBannerError(errBody?.message ?? errBody?.error ?? "儲存失敗");
        return;
      }
      const body = await res.json();
      const updated = extractData<KPI>(body);
      onSaved({ ...kpi, ...updated });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 border border-border rounded-lg p-4 space-y-3 bg-accent/20">
      <h3 className="text-xs font-medium text-muted-foreground">編輯 KPI</h3>
      <FormBanner message={bannerError} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <label className="text-xs text-muted-foreground">名稱 *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className={cn("w-full bg-accent border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary",
              fieldErrors.title ? "border-red-500" : "border-border")}
          />
          <FormError message={fieldErrors.title} />
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-xs text-muted-foreground">說明</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full bg-accent border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">目標值 *</label>
          <input
            type="number"
            value={form.target}
            onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
            className={cn("w-full bg-accent border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary",
              fieldErrors.target ? "border-red-500" : "border-border")}
          />
          <FormError message={fieldErrors.target} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">單位</label>
          <input
            type="text"
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            className="w-full bg-accent border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
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
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting ? "儲存中..." : "儲存"}
        </button>
      </div>
    </form>
  );
}
