"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { Plus, Loader2, X, ChevronRight, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractItems } from "@/lib/api-client";

type MilestoneStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DELAYED" | "CANCELLED";
type MilestoneType = "LAUNCH" | "AUDIT" | "CUSTOM";

type Milestone = {
  id: string;
  title: string;
  type: MilestoneType;
  status: MilestoneStatus;
  plannedEnd?: string | null;
  annualPlanId: string;
};

const MILESTONE_TYPE_LABEL: Record<MilestoneType, string> = {
  LAUNCH: "上線", AUDIT: "稽核", CUSTOM: "自定義",
};

const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  PENDING: "待開始", IN_PROGRESS: "進行中", COMPLETED: "已完成",
  DELAYED: "已延遲", CANCELLED: "已取消",
};

const MILESTONE_STATUS_COLOR: Record<MilestoneStatus, string> = {
  PENDING: "text-muted-foreground",
  IN_PROGRESS: "text-yellow-400",
  COMPLETED: "text-emerald-400",
  DELAYED: "text-orange-400",
  CANCELLED: "text-rose-400",
};

const MILESTONE_TRANSITIONS: Record<MilestoneStatus, MilestoneStatus[]> = {
  PENDING: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "DELAYED", "CANCELLED"],
  DELAYED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

interface MilestoneSectionProps {
  plans: { id: string; year: number; title: string }[];
}

const inputCls = "bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors placeholder:text-muted-foreground";
const selectCls = "bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors cursor-pointer";

function MilestoneSectionComponent({ plans }: MilestoneSectionProps) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  // Form state
  const [formPlanId, setFormPlanId] = useState(plans[0]?.id ?? "");
  useEffect(() => {
    if (!formPlanId && plans.length > 0) setFormPlanId(plans[0].id);
  }, [plans, formPlanId]);
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<MilestoneType>("CUSTOM");
  const [formPlannedEnd, setFormPlannedEnd] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchMilestones = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/milestones");
      if (res.ok) {
        const body = await res.json();
        setMilestones(extractItems<Milestone>(body));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMilestones(); }, [fetchMilestones]);

  async function updateStatus(id: string, status: MilestoneStatus) {
    setUpdating(id);
    try {
      const res = await fetch(`/api/milestones/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setMilestones((prev) => prev.map((m) => m.id === id ? { ...m, status } : m));
      }
    } finally {
      setUpdating(null);
    }
  }

  async function createMilestone() {
    if (!formTitle.trim() || !formPlanId) return;
    setCreating(true);
    setFormError("");
    try {
      const res = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annualPlanId: formPlanId,
          title: formTitle.trim(),
          type: formType,
          plannedEnd: formPlannedEnd || undefined,
        }),
      });
      if (res.ok) {
        setFormTitle("");
        setFormPlannedEnd("");
        setFormType("CUSTOM");
        setShowForm(false);
        setFormError("");
        fetchMilestones();
      } else {
        const errBody = await res.json().catch(() => ({}));
        setFormError(errBody?.message ?? errBody?.error ?? "建立失敗，請再試一次");
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 hover:text-foreground transition-colors"
        >
          <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", expanded && "rotate-90")} />
          <Flag className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">里程碑</span>
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <span className="text-xs text-muted-foreground">({milestones.length} 個)</span>
          )}
        </button>
        <button
          onClick={() => { setShowForm((v) => !v); setFormError(""); }}
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-card hover:bg-accent text-foreground rounded-md transition-colors border border-border"
        >
          <Plus className="h-3 w-3" />
          新增里程碑
        </button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">新增里程碑</span>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="年度計畫"
              value={formPlanId}
              onChange={(e) => setFormPlanId(e.target.value)}
              className={cn(selectCls, "flex-1 min-w-36")}
            >
              <option value="">選擇計畫</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.year} — {p.title}</option>
              ))}
            </select>
            <select
              aria-label="里程碑類型"
              value={formType}
              onChange={(e) => setFormType(e.target.value as MilestoneType)}
              className={cn(selectCls, "w-28")}
            >
              {(Object.keys(MILESTONE_TYPE_LABEL) as MilestoneType[]).map((t) => (
                <option key={t} value={t}>{MILESTONE_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createMilestone()}
              placeholder="里程碑標題"
              className={cn(inputCls, "flex-1 min-w-48")}
              autoFocus
            />
            <input
              type="date"
              value={formPlannedEnd}
              onChange={(e) => setFormPlannedEnd(e.target.value)}
              className={cn(inputCls, "w-40")}
              title="預計完成日期（選填）"
            />
            <button
              onClick={createMilestone}
              disabled={creating || !formTitle.trim() || !formPlanId}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-md disabled:opacity-40 transition-colors"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "建立"}
            </button>
          </div>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
        </div>
      )}

      {/* Milestone table */}
      {expanded && (
        <div className={cn("px-4 pb-4", !showForm && "border-t border-border pt-3")}>
          {milestones.length === 0 && !loading ? (
            <p className="text-xs text-muted-foreground text-center py-4">尚無里程碑</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">標題</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">類型</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">預計完成</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">狀態</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((m) => {
                  const transitions = MILESTONE_TRANSITIONS[m.status];
                  const isTerminal = transitions.length === 0;
                  return (
                    <tr key={m.id} className="border-b border-border/20 hover:bg-accent/20">
                      <td className="py-1.5 px-2 font-medium text-foreground">{m.title}</td>
                      <td className="py-1.5 px-2 text-muted-foreground">{MILESTONE_TYPE_LABEL[m.type]}</td>
                      <td className="py-1.5 px-2 text-muted-foreground tabular-nums">
                        {m.plannedEnd ? new Date(m.plannedEnd).toLocaleDateString("zh-TW") : "—"}
                      </td>
                      <td className="py-1.5 px-2">
                        {updating === m.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        ) : isTerminal ? (
                          <span className={cn("font-medium", MILESTONE_STATUS_COLOR[m.status])}>
                            {MILESTONE_STATUS_LABEL[m.status]}
                          </span>
                        ) : (
                          <select
                            aria-label="里程碑狀態"
                            value={m.status}
                            onChange={(e) => updateStatus(m.id, e.target.value as MilestoneStatus)}
                            className={cn(
                              "bg-background border border-border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer",
                              MILESTONE_STATUS_COLOR[m.status]
                            )}
                          >
                            <option value={m.status}>{MILESTONE_STATUS_LABEL[m.status]}</option>
                            {transitions.map((s) => (
                              <option key={s} value={s}>{MILESTONE_STATUS_LABEL[s]}</option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export const MilestoneSection = memo(MilestoneSectionComponent);
