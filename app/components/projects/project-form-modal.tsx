"use client";

import { useState, useEffect } from "react";
import { X, AlertTriangle, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { UserOption } from "@/app/(app)/projects/types";
import { MD_STAGES } from "@/app/(app)/projects/constants";

interface CreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  users: UserOption[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic key access on typed objects
function getNumField(obj: { [k: string]: any } | null | undefined, key: string): number {
  const v = obj?.[key];
  return typeof v === "number" ? v : 0;
}

function fmtNum(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("zh-TW");
}

export function CreateProjectModal({
  open,
  onClose,
  onCreated,
  users,
}: CreateModalProps) {
  const currentYear = new Date().getFullYear();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [categoryOptions, setCategoryOptions] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (open) {
      fetch("/api/project-categories")
        .then((r) => r.json())
        .then((body) => setCategoryOptions(body.data ?? []))
        .catch(() => { toast.warning("專案類別載入失敗"); });
    }
  }, [open]);

  const [form, setForm] = useState({
    // Step 1 — basic
    name: "",
    year: currentYear,
    category: "",
    requestDept: "",
    requestContact: "",
    businessGoal: "",
    // Step 2 — evaluation
    benefitRevenue: 0,
    benefitCompliance: 0,
    benefitEfficiency: 0,
    benefitRisk: 0,
    feasibility: "PENDING",
    riskLevel: "MEDIUM",
    techComplexity: "MEDIUM",
    // Step 3 — man-days & budget
    mdProjectMgmt: 0,
    mdRequirements: 0,
    mdDesign: 0,
    mdDevelopment: 0,
    mdTesting: 0,
    mdDeployment: 0,
    mdDocumentation: 0,
    mdTraining: 0,
    mdMaintenance: 0,
    mdOther: 0,
    budgetExternal: 0,
    budgetHardware: 0,
    budgetLicense: 0,
    budgetOther: 0,
    costPerManDay: 5000,
    // Step 4 — schedule & team
    plannedStart: "",
    plannedEnd: "",
    ownerId: "",
    devDept: "",
    vendor: "",
  });

  const setField = (key: string, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  const mdTotal = MD_STAGES.reduce(
    (s, { key }) => s + getNumField(form, key),
    0
  );
  const budgetInternal = mdTotal * form.costPerManDay;
  const budgetTotal =
    budgetInternal +
    form.budgetExternal +
    form.budgetHardware +
    form.budgetLicense +
    form.budgetOther;
  const benefitTotal =
    form.benefitRevenue +
    form.benefitCompliance +
    form.benefitEfficiency +
    form.benefitRisk;

  async function handleSubmit() {
    if (!form.name.trim()) {
      setError("項目名稱為必填");
      return;
    }
    if (!form.requestDept.trim()) {
      setError("需求部門為必填");
      return;
    }
    if (!form.ownerId) {
      setError("負責人為必填");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          budgetInternal,
          budgetTotal,
          mdTotalEstimated: mdTotal,
          benefitScore: benefitTotal,
          plannedStart: form.plannedStart || undefined,
          plannedEnd: form.plannedEnd || undefined,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setError(errBody?.message ?? errBody?.error ?? "建立失敗");
        return;
      }
      toast.success("項目已建立");
      onCreated();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const steps = ["基本資訊", "評估", "人天與預算", "排期與團隊"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold">新增項目</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-1 px-5 pt-4 pb-2">
          {steps.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(i + 1)}
              className={cn(
                "flex-1 text-center py-1.5 text-xs rounded-md transition-colors",
                step === i + 1
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {i + 1}. {s}
            </button>
          ))}
        </div>

        {/* Form body */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">
                  項目名稱 *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="輸入項目名稱"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">
                    年度 *
                  </label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) =>
                      setField("year", parseInt(e.target.value) || currentYear)
                    }
                    className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">類別</label>
                  <select
                    value={form.category}
                    onChange={(e) => setField("category", e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">請選擇類別</option>
                    {categoryOptions.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">
                    需求部門 *
                  </label>
                  <input
                    type="text"
                    value={form.requestDept}
                    onChange={(e) => setField("requestDept", e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="如：法遵部"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">
                    需求聯繫人
                  </label>
                  <input
                    type="text"
                    value={form.requestContact}
                    onChange={(e) =>
                      setField("requestContact", e.target.value)
                    }
                    className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  業務目標
                </label>
                <textarea
                  value={form.businessGoal}
                  onChange={(e) => setField("businessGoal", e.target.value)}
                  rows={3}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  placeholder="描述業務目標..."
                />
              </div>
            </div>
          )}

          {/* Step 2: Evaluation */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-3">
                  效益評估（每項 0-25 分）
                </p>
                {[
                  { key: "benefitRevenue", label: "營收增長/成本節省" },
                  { key: "benefitCompliance", label: "法規遵循/監管要求" },
                  { key: "benefitEfficiency", label: "營運效率提升" },
                  { key: "benefitRisk", label: "風險控制/降低" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3 mb-3">
                    <span className="text-xs text-muted-foreground w-36">
                      {label}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={25}
                      value={getNumField(form, key)}
                      onChange={(e) =>
                        setField(key, parseInt(e.target.value))
                      }
                      className="flex-1 h-2 accent-primary"
                    />
                    <span className="text-sm font-medium tabular-nums w-10 text-right">
                      {getNumField(form, key)}/25
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-1 pt-2 border-t border-border/50">
                  <span className="text-xs font-medium text-muted-foreground">
                    效益總分
                  </span>
                  <span className="text-lg font-semibold tabular-nums">
                    {benefitTotal}/100
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">
                    可行性結論
                  </label>
                  <select
                    value={form.feasibility}
                    onChange={(e) => setField("feasibility", e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
                  >
                    <option value="PENDING">待評估</option>
                    <option value="FEASIBLE">可行</option>
                    <option value="CONDITIONAL">有條件可行</option>
                    <option value="NOT_FEASIBLE">不可行</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">
                    風險等級
                  </label>
                  <select
                    value={form.riskLevel}
                    onChange={(e) => setField("riskLevel", e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
                  >
                    <option value="LOW">低</option>
                    <option value="MEDIUM">中</option>
                    <option value="HIGH">高</option>
                    <option value="CRITICAL">極高</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">
                    技術複雜度
                  </label>
                  <select
                    value={form.techComplexity}
                    onChange={(e) =>
                      setField("techComplexity", e.target.value)
                    }
                    className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
                  >
                    <option value="LOW">低</option>
                    <option value="MEDIUM">中</option>
                    <option value="HIGH">高</option>
                    <option value="VERY_HIGH">極高</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Man-days & Budget */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-3">各階段人天預估</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border/50">
                      <th className="text-left py-2 font-medium">階段</th>
                      <th className="text-right py-2 font-medium w-28">
                        預估人天
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {MD_STAGES.map(({ key, label }) => (
                      <tr key={key} className="border-b border-border/30">
                        <td className="py-2 text-foreground">{label}</td>
                        <td className="py-2">
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={getNumField(form, key)}
                            onChange={(e) =>
                              setField(
                                key,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full text-right px-2 py-1 text-sm border border-border rounded bg-background"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-medium border-t-2 border-border">
                      <td className="py-2">合計</td>
                      <td className="py-2 text-right tabular-nums">
                        {mdTotal} 人天
                      </td>
                    </tr>
                    <tr className="text-muted-foreground">
                      <td className="py-1 text-xs">
                        預估成本（每人天 NT${fmtNum(form.costPerManDay)}）
                      </td>
                      <td className="py-1 text-right tabular-nums text-xs">
                        NT$ {fmtNum(budgetInternal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div>
                <p className="text-sm font-medium mb-3">預算</p>
                <div className="space-y-2">
                  {[
                    { key: "budgetExternal", label: "外部委外" },
                    { key: "budgetHardware", label: "硬體/設備" },
                    { key: "budgetLicense", label: "軟體授權" },
                    { key: "budgetOther", label: "其他" },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-24">
                        {label}
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={getNumField(form, key)}
                        onChange={(e) =>
                          setField(key, parseFloat(e.target.value) || 0)
                        }
                        className="flex-1 px-3 py-1.5 text-sm border border-border rounded bg-background text-right"
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50 font-medium">
                    <span className="text-xs">總預算</span>
                    <span className="tabular-nums">
                      NT$ {fmtNum(budgetTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Schedule & Team */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">
                    計劃開始
                  </label>
                  <input
                    type="date"
                    value={form.plannedStart}
                    onChange={(e) =>
                      setField("plannedStart", e.target.value)
                    }
                    className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">
                    計劃結束
                  </label>
                  <input
                    type="date"
                    value={form.plannedEnd}
                    onChange={(e) => setField("plannedEnd", e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  負責人 (PM) *
                </label>
                <select
                  value={form.ownerId}
                  onChange={(e) => setField("ownerId", e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
                >
                  <option value="">選擇負責人</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  開發單位
                </label>
                <input
                  type="text"
                  value={form.devDept}
                  onChange={(e) => setField("devDept", e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
                  placeholder="如：應用開發科"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">廠商</label>
                <input
                  type="text"
                  value={form.vendor}
                  onChange={(e) => setField("vendor", e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
                  placeholder="主要廠商名稱"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-border">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          >
            {step > 1 ? "上一步" : "取消"}
          </button>
          <div className="flex gap-2">
            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                下一步
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {submitting ? "建立中..." : "建立項目"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
