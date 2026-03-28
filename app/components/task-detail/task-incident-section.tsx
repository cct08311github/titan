"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { AlertTriangle, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";

type IncidentSeverity = "SEV1" | "SEV2" | "SEV3" | "SEV4";

type IncidentRecord = {
  id: string;
  taskId: string;
  severity: IncidentSeverity;
  impactScope: string;
  incidentStart: string;
  incidentEnd: string | null;
  rootCause: string | null;
  resolution: string | null;
  mttrMinutes: number | null;
  reportedBy: string | null;
};

const severityOptions: { value: IncidentSeverity; label: string }[] = [
  { value: "SEV1", label: "SEV1 — 核心系統中斷" },
  { value: "SEV2", label: "SEV2 — 主要功能受損" },
  { value: "SEV3", label: "SEV3 — 次要功能受損" },
  { value: "SEV4", label: "SEV4 — 輕微影響" },
];

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

function formatMttr(minutes: number | null): string {
  if (minutes === null) return "處理中";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} 分鐘`;
  return `${hours} 小時 ${mins} 分鐘`;
}

function toLocalDatetime(isoStr: string | null): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  // Format: YYYY-MM-DDTHH:mm for datetime-local input
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface TaskIncidentSectionProps {
  taskId: string;
  category: string;
  onCategoryChangeFromIncident?: () => void;
}

export function TaskIncidentSection({ taskId, category }: TaskIncidentSectionProps) {
  const [record, setRecord] = useState<IncidentRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    severity: "SEV2" as IncidentSeverity,
    impactScope: "",
    incidentStart: "",
    incidentEnd: "",
    rootCause: "",
    resolution: "",
    reportedBy: "",
  });

  const isIncident = category === "INCIDENT";
  const hasErrors = Object.keys(errors).length > 0;

  function validateField(field: "impactScope" | "incidentStart", value: string) {
    setErrors((prev) => {
      const next = { ...prev };
      if (field === "impactScope" && !value.trim()) {
        next.impactScope = "影響範圍為必填欄位";
      } else if (field === "incidentStart" && !value) {
        next.incidentStart = "事件開始時間為必填欄位";
      } else {
        delete next[field];
      }
      return next;
    });
  }

  function clearError(field: string) {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  const loadRecord = useCallback(async () => {
    if (!isIncident) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/incident`);
      if (res.ok) {
        const body = await res.json();
        const data = extractData<IncidentRecord | null>(body);
        if (data) {
          setRecord(data);
          setForm({
            severity: data.severity,
            impactScope: data.impactScope,
            incidentStart: toLocalDatetime(data.incidentStart),
            incidentEnd: toLocalDatetime(data.incidentEnd),
            rootCause: data.rootCause ?? "",
            resolution: data.resolution ?? "",
            reportedBy: data.reportedBy ?? "",
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [taskId, isIncident]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  // Calculate MTTR from form values
  const mttrMinutes = (() => {
    if (!form.incidentStart || !form.incidentEnd) return null;
    const start = new Date(form.incidentStart);
    const end = new Date(form.incidentEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    const diff = Math.round((end.getTime() - start.getTime()) / 60000);
    return diff > 0 ? diff : null;
  })();

  async function saveIncident() {
    // Validate all required fields on submit
    const newErrors: Record<string, string> = {};
    if (!form.impactScope.trim()) newErrors.impactScope = "影響範圍為必填欄位";
    if (!form.incidentStart) newErrors.incidentStart = "事件開始時間為必填欄位";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("嚴重等級、影響範圍、事件開始時間為必填欄位");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        severity: form.severity,
        impactScope: form.impactScope,
        incidentStart: new Date(form.incidentStart).toISOString(),
        incidentEnd: form.incidentEnd ? new Date(form.incidentEnd).toISOString() : null,
        rootCause: form.rootCause || null,
        resolution: form.resolution || null,
        reportedBy: form.reportedBy || null,
      };

      const method = record ? "PATCH" : "POST";
      const res = await fetch(`/api/tasks/${taskId}/incident`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const body = await res.json();
        const data = extractData<IncidentRecord>(body);
        setRecord(data);
        toast.success("事件紀錄已儲存");
      } else {
        const errBody = await res.json().catch(() => ({}));
        const msg = errBody?.message ?? errBody?.error ?? "儲存事件紀錄失敗";
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!isIncident) return null;

  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
        事件管理
      </h3>
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Severity + Impact */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>嚴重等級 *</Label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as IncidentSeverity }))}
                  className={selectCls}
                >
                  {severityOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>通報人</Label>
                <input
                  type="text"
                  value={form.reportedBy}
                  onChange={(e) => setForm((f) => ({ ...f, reportedBy: e.target.value }))}
                  placeholder="通報人姓名"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Impact scope */}
            <div>
              <Label>影響範圍 *</Label>
              <textarea
                value={form.impactScope}
                onChange={(e) => {
                  setForm((f) => ({ ...f, impactScope: e.target.value }));
                  if (e.target.value.trim()) clearError("impactScope");
                }}
                onBlur={(e) => validateField("impactScope", e.target.value)}
                rows={2}
                placeholder="描述事件影響的系統、服務或使用者..."
                className={cn(textareaCls, errors.impactScope && errorInputCls)}
              />
              {errors.impactScope && <p className="text-sm text-destructive mt-1">{errors.impactScope}</p>}
            </div>

            {/* Start / End times */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>事件開始時間 *</Label>
                <input
                  type="datetime-local"
                  value={form.incidentStart}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, incidentStart: e.target.value }));
                    if (e.target.value) clearError("incidentStart");
                  }}
                  onBlur={(e) => validateField("incidentStart", e.target.value)}
                  className={cn(inputCls, errors.incidentStart && errorInputCls)}
                />
                {errors.incidentStart && <p className="text-sm text-destructive mt-1">{errors.incidentStart}</p>}
              </div>
              <div>
                <Label>事件結束時間</Label>
                <input
                  type="datetime-local"
                  value={form.incidentEnd}
                  onChange={(e) => setForm((f) => ({ ...f, incidentEnd: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>

            {/* MTTR display */}
            <div className="flex items-center gap-2 px-3 py-2 bg-background rounded-lg border border-border">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">MTTR：</span>
              <span className="text-sm font-medium">
                {formatMttr(mttrMinutes)}
              </span>
            </div>

            {/* Root cause */}
            <div>
              <Label>根因分析</Label>
              <textarea
                value={form.rootCause}
                onChange={(e) => setForm((f) => ({ ...f, rootCause: e.target.value }))}
                rows={3}
                placeholder="根因分析（支援 Markdown 格式）..."
                className={textareaCls}
              />
            </div>

            {/* Resolution */}
            <div>
              <Label>解決方案</Label>
              <textarea
                value={form.resolution}
                onChange={(e) => setForm((f) => ({ ...f, resolution: e.target.value }))}
                rows={3}
                placeholder="解決方案描述（支援 Markdown 格式）..."
                className={textareaCls}
              />
            </div>

            {/* Save button */}
            <div className="flex justify-end">
              <button
                onClick={saveIncident}
                disabled={saving || hasErrors}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium h-8 px-4 rounded-lg transition-all",
                  "bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                {record ? "更新事件紀錄" : "建立事件紀錄"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
