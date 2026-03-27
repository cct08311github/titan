"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";

type CMChangeType = "NORMAL" | "STANDARD" | "EMERGENCY";
type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type ChangeStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "IN_PROGRESS"
  | "VERIFYING"
  | "COMPLETED"
  | "ROLLED_BACK"
  | "CANCELLED";

type ChangeRecord = {
  id: string;
  taskId: string;
  changeNumber: string;
  type: CMChangeType;
  riskLevel: RiskLevel;
  impactedSystems: string[];
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  rollbackPlan: string | null;
  verificationPlan: string | null;
  status: ChangeStatus;
  cabApprovedBy: string | null;
  cabApprovedAt: string | null;
};

const changeTypeOptions: { value: CMChangeType; label: string }[] = [
  { value: "NORMAL", label: "一般變更（需 CAB 核准）" },
  { value: "STANDARD", label: "標準變更（預核准）" },
  { value: "EMERGENCY", label: "緊急變更（事後補單）" },
];

const riskLevelOptions: { value: RiskLevel; label: string }[] = [
  { value: "LOW", label: "低" },
  { value: "MEDIUM", label: "中" },
  { value: "HIGH", label: "高" },
  { value: "CRITICAL", label: "重大" },
];

const STATUS_STEPS: { key: ChangeStatus; label: string }[] = [
  { key: "DRAFT", label: "草稿" },
  { key: "PENDING_APPROVAL", label: "待核准" },
  { key: "APPROVED", label: "已核准" },
  { key: "IN_PROGRESS", label: "執行中" },
  { key: "VERIFYING", label: "驗證中" },
  { key: "COMPLETED", label: "已完成" },
];

const STEP_ORDER: ChangeStatus[] = [
  "DRAFT", "PENDING_APPROVAL", "APPROVED", "IN_PROGRESS", "VERIFYING", "COMPLETED",
];

function getStepState(step: ChangeStatus, current: ChangeStatus): "done" | "current" | "upcoming" | "special" {
  if (current === "ROLLED_BACK" || current === "CANCELLED") return "special";
  const stepIdx = STEP_ORDER.indexOf(step);
  const currentIdx = STEP_ORDER.indexOf(current);
  if (stepIdx < currentIdx) return "done";
  if (stepIdx === currentIdx) return "current";
  return "upcoming";
}

const inputCls =
  "w-full h-10 bg-background border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/60";
const selectCls =
  "w-full h-10 bg-background border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer";
const textareaCls =
  "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/60 resize-none";
const errorInputCls = "border-destructive focus:border-destructive focus:ring-destructive/10";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-muted-foreground mb-1.5">{children}</label>;
}

function toLocalDatetime(isoStr: string | null): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface TaskChangeManagementSectionProps {
  taskId: string;
}

export function TaskChangeManagementSection({ taskId }: TaskChangeManagementSectionProps) {
  const [record, setRecord] = useState<ChangeRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newSystem, setNewSystem] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    type: "NORMAL" as CMChangeType,
    riskLevel: "MEDIUM" as RiskLevel,
    impactedSystems: [] as string[],
    scheduledStart: "",
    scheduledEnd: "",
    rollbackPlan: "",
    verificationPlan: "",
  });

  const hasErrors = Object.keys(errors).length > 0;

  const loadRecord = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/change`);
      if (res.ok) {
        const body = await res.json();
        const data = extractData<ChangeRecord | null>(body);
        if (data) {
          setRecord(data);
          setForm({
            type: data.type,
            riskLevel: data.riskLevel,
            impactedSystems: data.impactedSystems,
            scheduledStart: toLocalDatetime(data.scheduledStart),
            scheduledEnd: toLocalDatetime(data.scheduledEnd),
            rollbackPlan: data.rollbackPlan ?? "",
            verificationPlan: data.verificationPlan ?? "",
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  function addSystem() {
    const trimmed = newSystem.trim();
    if (trimmed && !form.impactedSystems.includes(trimmed)) {
      setForm((f) => ({ ...f, impactedSystems: [...f.impactedSystems, trimmed] }));
      setNewSystem("");
      // Clear error when a system is added
      if (errors.impactedSystems) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next.impactedSystems;
          return next;
        });
      }
    }
  }

  function removeSystem(sys: string) {
    setForm((f) => {
      const updated = f.impactedSystems.filter((s) => s !== sys);
      return { ...f, impactedSystems: updated };
    });
    // Check after setForm — avoid calling setErrors inside setForm updater
    const remaining = form.impactedSystems.filter((s) => s !== sys);
    if (remaining.length === 0) {
      setErrors((prev) => ({ ...prev, impactedSystems: "至少需要一個受影響系統" }));
    }
  }

  function handleSystemKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSystem();
    }
  }

  async function saveRecord() {
    // Validate on submit
    if (form.impactedSystems.length === 0) {
      setErrors((prev) => ({ ...prev, impactedSystems: "至少需要一個受影響系統" }));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        type: form.type,
        riskLevel: form.riskLevel,
        impactedSystems: form.impactedSystems,
        scheduledStart: form.scheduledStart ? new Date(form.scheduledStart).toISOString() : null,
        scheduledEnd: form.scheduledEnd ? new Date(form.scheduledEnd).toISOString() : null,
        rollbackPlan: form.rollbackPlan || null,
        verificationPlan: form.verificationPlan || null,
      };

      const method = record ? "PATCH" : "POST";
      const res = await fetch(`/api/tasks/${taskId}/change`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const body = await res.json();
        const data = extractData<ChangeRecord>(body);
        setRecord(data);
      } else {
        const errBody = await res.json().catch(() => ({}));
        alert(errBody?.message ?? "儲存變更紀錄失敗");
      }
    } finally {
      setSaving(false);
    }
  }

  async function transitionStatus(targetStatus: ChangeStatus) {
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/change/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });

      if (res.ok) {
        const body = await res.json();
        const data = extractData<ChangeRecord>(body);
        setRecord(data);
      } else {
        const errBody = await res.json().catch(() => ({}));
        alert(errBody?.message ?? "狀態轉移失敗");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5 text-blue-500" />
        變更管理
      </h3>
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Change number (read-only) */}
            {record && (
              <div className="flex items-center gap-2 px-3 py-2 bg-background rounded-lg border border-border">
                <span className="text-xs text-muted-foreground">變更編號：</span>
                <span className="text-sm font-mono font-medium">{record.changeNumber}</span>
              </div>
            )}

            {/* Status progress bar */}
            {record && (
              <div className="px-1">
                {record.status === "ROLLED_BACK" || record.status === "CANCELLED" ? (
                  <div className={cn(
                    "text-center text-sm font-medium py-2 rounded-lg",
                    record.status === "ROLLED_BACK" ? "bg-orange-500/10 text-orange-600" : "bg-gray-500/10 text-gray-500"
                  )}>
                    {record.status === "ROLLED_BACK" ? "已回滾" : "已取消"}
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    {STATUS_STEPS.map((step, idx) => {
                      const state = getStepState(step.key, record.status);
                      return (
                        <div key={step.key} className="flex items-center flex-1">
                          <div className="flex flex-col items-center flex-1">
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                              state === "done" && "bg-green-500 text-white",
                              state === "current" && "bg-blue-500 text-white",
                              state === "upcoming" && "bg-gray-200 text-gray-400",
                            )}>
                              {idx + 1}
                            </div>
                            <span className={cn(
                              "text-[9px] mt-0.5 text-center leading-tight",
                              state === "current" ? "text-blue-600 font-medium" : "text-muted-foreground",
                            )}>
                              {step.label}
                            </span>
                          </div>
                          {idx < STATUS_STEPS.length - 1 && (
                            <div className={cn(
                              "h-0.5 flex-1 mx-0.5 mt-[-12px]",
                              state === "done" ? "bg-green-500" : "bg-gray-200",
                            )} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Type + Risk */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>變更類型 *</Label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CMChangeType }))}
                  className={selectCls}
                  disabled={!!record && record.status !== "DRAFT"}
                >
                  {changeTypeOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>風險等級 *</Label>
                <select
                  value={form.riskLevel}
                  onChange={(e) => setForm((f) => ({ ...f, riskLevel: e.target.value as RiskLevel }))}
                  className={selectCls}
                  disabled={!!record && record.status !== "DRAFT"}
                >
                  {riskLevelOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Impacted systems (tag input) */}
            <div>
              <Label>受影響系統 *</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.impactedSystems.map((sys) => (
                  <span
                    key={sys}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-700 text-xs rounded-full"
                  >
                    {sys}
                    <button
                      type="button"
                      onClick={() => removeSystem(sys)}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSystem}
                  onChange={(e) => setNewSystem(e.target.value)}
                  onKeyDown={handleSystemKeyDown}
                  onBlur={() => {
                    if (form.impactedSystems.length === 0 && !newSystem.trim()) {
                      setErrors((prev) => ({ ...prev, impactedSystems: "至少需要一個受影響系統" }));
                    }
                  }}
                  placeholder="輸入系統名稱，按 Enter 新增"
                  className={cn(inputCls, errors.impactedSystems && errorInputCls)}
                />
                <button
                  type="button"
                  onClick={addSystem}
                  className="h-10 px-3 bg-blue-500/10 text-blue-600 rounded-lg hover:bg-blue-500/20 transition-all"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {errors.impactedSystems && <p className="text-sm text-destructive mt-1">{errors.impactedSystems}</p>}
            </div>

            {/* Scheduled window */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>預定開始時間</Label>
                <input
                  type="datetime-local"
                  value={form.scheduledStart}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledStart: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <Label>預定結束時間</Label>
                <input
                  type="datetime-local"
                  value={form.scheduledEnd}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledEnd: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Rollback plan */}
            <div>
              <Label>回滾方案</Label>
              <textarea
                value={form.rollbackPlan}
                onChange={(e) => setForm((f) => ({ ...f, rollbackPlan: e.target.value }))}
                rows={3}
                placeholder="回滾方案描述（支援 Markdown）..."
                className={textareaCls}
              />
            </div>

            {/* Verification plan */}
            <div>
              <Label>驗證計畫</Label>
              <textarea
                value={form.verificationPlan}
                onChange={(e) => setForm((f) => ({ ...f, verificationPlan: e.target.value }))}
                rows={3}
                placeholder="變更完成後的驗證步驟..."
                className={textareaCls}
              />
            </div>

            {/* CAB info (read-only when approved) */}
            {record?.cabApprovedBy && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 rounded-lg border border-green-500/20">
                <span className="text-xs text-green-700">
                  CAB 已核准：{record.cabApprovedAt ? new Date(record.cabApprovedAt).toLocaleString("zh-TW") : "—"}
                </span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-end gap-2">
              {/* Status transition buttons */}
              {record && record.status === "DRAFT" && (
                <button
                  onClick={() => transitionStatus("PENDING_APPROVAL")}
                  disabled={saving}
                  className="text-xs font-medium h-8 px-4 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-40 transition-all"
                >
                  送出核准
                </button>
              )}
              {record && record.status === "DRAFT" && record.type === "EMERGENCY" && (
                <button
                  onClick={() => transitionStatus("APPROVED")}
                  disabled={saving}
                  className="text-xs font-medium h-8 px-4 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 transition-all"
                >
                  緊急核准
                </button>
              )}
              {record && record.status === "PENDING_APPROVAL" && (
                <button
                  onClick={() => transitionStatus("APPROVED")}
                  disabled={saving}
                  className="text-xs font-medium h-8 px-4 rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:opacity-40 transition-all"
                >
                  核准
                </button>
              )}
              {record && record.status === "APPROVED" && (
                <button
                  onClick={() => transitionStatus("IN_PROGRESS")}
                  disabled={saving}
                  className="text-xs font-medium h-8 px-4 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-all"
                >
                  開始執行
                </button>
              )}
              {record && record.status === "IN_PROGRESS" && (
                <>
                  <button
                    onClick={() => transitionStatus("VERIFYING")}
                    disabled={saving}
                    className="text-xs font-medium h-8 px-4 rounded-lg bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-40 transition-all"
                  >
                    進入驗證
                  </button>
                  <button
                    onClick={() => transitionStatus("ROLLED_BACK")}
                    disabled={saving}
                    className="text-xs font-medium h-8 px-4 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition-all"
                  >
                    回滾
                  </button>
                </>
              )}
              {record && record.status === "VERIFYING" && (
                <>
                  <button
                    onClick={() => transitionStatus("COMPLETED")}
                    disabled={saving}
                    className="text-xs font-medium h-8 px-4 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition-all"
                  >
                    驗證通過
                  </button>
                  <button
                    onClick={() => transitionStatus("IN_PROGRESS")}
                    disabled={saving}
                    className="text-xs font-medium h-8 px-4 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-40 transition-all"
                  >
                    退回重做
                  </button>
                </>
              )}

              {/* Save / create button */}
              <button
                onClick={saveRecord}
                disabled={saving || hasErrors}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium h-8 px-4 rounded-lg transition-all",
                  "bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                {record ? "更新變更紀錄" : "建立變更紀錄"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
