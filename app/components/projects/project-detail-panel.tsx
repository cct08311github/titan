"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Plus,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";
import { PageLoading } from "@/app/components/page-states";
import { StakeholderMatrix } from "@/app/components/stakeholder-matrix";
import type {
  ProjectDetail,
  ProjectGate,
  ChecklistItem,
  UserOption,
} from "@/app/(app)/projects/types";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  RISK_SCORE_COLOR,
  SEVERITY_COLORS,
  GATE_STATUS_COLORS,
  STATUS_FLOW,
  MD_STAGES,
  BUDGET_FIELDS,
} from "@/app/(app)/projects/constants";

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return d.split("T")[0];
}

function fmtNum(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("zh-TW");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic key access on typed objects
function getNumField(obj: { [k: string]: any } | null | undefined, key: string): number {
  const v = obj?.[key];
  return typeof v === "number" ? v : 0;
}

// ── Small Components ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium",
        STATUS_COLORS[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function KVItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

function ScoreCard({
  label,
  value,
  max,
}: {
  label: string;
  value: number | null;
  max: number;
}) {
  const pct = value != null ? (value / max) * 100 : 0;
  return (
    <div className="bg-accent/30 rounded-lg p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums mt-0.5">
        {value ?? "—"}
        <span className="text-xs text-muted-foreground">/{max}</span>
      </p>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-2">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function SimpleBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-1.5 bg-accent/50 rounded-lg">
      <span className="text-[11px] text-muted-foreground mr-2">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}

// ── Gate Card ──────────────────────────────────────────────────────────────

function GateCard({
  gate,
  isManager,
  onUpdate,
}: {
  gate: ProjectGate;
  isManager: boolean;
  onUpdate: (data: Record<string, unknown>) => void;
}) {
  const [localChecklist, setLocalChecklist] = useState<ChecklistItem[]>(
    Array.isArray(gate.checklist) ? gate.checklist : []
  );
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLocalChecklist(
      Array.isArray(gate.checklist) ? gate.checklist : []
    );
    setDirty(false);
  }, [gate.checklist]);

  function toggleItem(index: number) {
    const updated = localChecklist.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    );
    setLocalChecklist(updated);
    setDirty(true);
  }

  function saveChecklist() {
    onUpdate({ checklist: localChecklist });
    setDirty(false);
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        GATE_STATUS_COLORS[gate.status] ?? GATE_STATUS_COLORS.PENDING
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-medium">{gate.name}</p>
          <p className="text-[11px] text-muted-foreground">{gate.phase}</p>
        </div>
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-medium border",
            GATE_STATUS_COLORS[gate.status] ?? ""
          )}
        >
          {gate.status}
        </span>
      </div>

      {/* Checklist */}
      <div className="space-y-1.5 mb-3">
        {localChecklist.map((item, i) => (
          <label key={i} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => isManager && toggleItem(i)}
              disabled={!isManager}
              className="rounded"
            />
            <span
              className={cn(
                "text-sm",
                item.checked ? "line-through text-muted-foreground" : ""
              )}
            >
              {item.item}
            </span>
          </label>
        ))}
      </div>

      {/* Save checklist changes */}
      {dirty && isManager && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] text-amber-500">未儲存的變更</span>
          <button
            onClick={saveChecklist}
            className="px-2.5 py-1 text-xs bg-primary/10 text-primary border border-primary/30 rounded-md hover:bg-primary/20"
          >
            儲存
          </button>
        </div>
      )}

      {/* Reviewer info */}
      {gate.reviewer && (
        <p className="text-[11px] text-muted-foreground mb-2">
          審核人: {gate.reviewer.name}
          {gate.reviewedAt && ` (${fmtDate(gate.reviewedAt)})`}
        </p>
      )}
      {gate.reviewNote && (
        <p className="text-xs text-muted-foreground mb-2">
          意見: {gate.reviewNote}
        </p>
      )}

      {/* Actions */}
      {isManager && gate.status !== "PASSED" && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onUpdate({ status: "PASSED" })}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded-md hover:bg-emerald-500/20"
          >
            <CheckCircle2 className="h-3 w-3" />
            通過
          </button>
          <button
            onClick={() => onUpdate({ status: "BLOCKED" })}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-500/10 text-red-500 border border-red-500/30 rounded-md hover:bg-red-500/20"
          >
            <Ban className="h-3 w-3" />
            阻擋
          </button>
        </div>
      )}
    </div>
  );
}

// ── Detail Panel ───────────────────────────────────────────────────────────

const DETAIL_TABS = [
  { key: "info", label: "基本資訊" },
  { key: "benefit", label: "效益" },
  { key: "feasibility", label: "可行性" },
  { key: "manday", label: "人天與預算" },
  { key: "schedule", label: "排期" },
  { key: "progress", label: "進展" },
  { key: "stakeholder", label: "利害關係人" },
  { key: "risk", label: "風險與議題" },
  { key: "gate", label: "Gate Review" },
  { key: "review", label: "後評價" },
];

interface DetailPanelProps {
  projectId: string;
  onClose: () => void;
  isManager: boolean;
  users: UserOption[];
  onRefreshList: () => void;
}

export function DetailPanel({
  projectId,
  onClose,
  isManager,
  users,
  onRefreshList,
}: DetailPanelProps) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("info");

  const fetchProject = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("載入失敗");
      const body = await res.json();
      setProject(extractData<ProjectDetail>(body));
    } catch {
      toast.error("項目載入失敗");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // ── Risk/Issue inline create ─────────────────────────────────────────
  const [showRiskForm, setShowRiskForm] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [riskForm, setRiskForm] = useState({
    title: "",
    probability: "MEDIUM",
    impact: "MEDIUM",
    ownerId: "",
  });
  const [issueForm, setIssueForm] = useState({
    title: "",
    severity: "MEDIUM",
    assigneeId: "",
  });

  async function createRisk() {
    if (!riskForm.title || !riskForm.ownerId) {
      toast.error("請填寫完整風險資訊");
      return;
    }
    const res = await fetch(`/api/projects/${projectId}/risks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(riskForm),
    });
    if (res.ok) {
      toast.success("風險已新增");
      setShowRiskForm(false);
      setRiskForm({ title: "", probability: "MEDIUM", impact: "MEDIUM", ownerId: "" });
      fetchProject();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err?.message ?? "新增失敗");
    }
  }

  async function createIssue() {
    if (!issueForm.title || !issueForm.assigneeId) {
      toast.error("請填寫完整議題資訊");
      return;
    }
    const res = await fetch(`/api/projects/${projectId}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(issueForm),
    });
    if (res.ok) {
      toast.success("議題已新增");
      setShowIssueForm(false);
      setIssueForm({ title: "", severity: "MEDIUM", assigneeId: "" });
      fetchProject();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err?.message ?? "新增失敗");
    }
  }

  // ── Gate actions ─────────────────────────────────────────────────────
  async function updateGate(gateId: string, data: Record<string, unknown>) {
    const res = await fetch(
      `/api/projects/${projectId}/gates/${gateId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    if (res.ok) {
      toast.success("Gate 已更新");
      fetchProject();
      onRefreshList();
    } else {
      toast.error("Gate 更新失敗");
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-y-0 right-0 w-full sm:w-[600px] bg-card border-l border-border shadow-2xl z-40 overflow-y-auto">
        <PageLoading message="載入項目詳情..." />
      </div>
    );
  }

  if (!project) return null;

  const p = project;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[600px] bg-card border-l border-border shadow-2xl z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">
              {p.code}
            </span>
            <StatusBadge status={p.status} />
          </div>
          <h2 className="text-base font-semibold mt-1 truncate">{p.name}</h2>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-border flex-shrink-0 px-2">
        {DETAIL_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-2.5 text-xs whitespace-nowrap transition-colors border-b-2",
              tab === t.key
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Tab 1: Basic Info */}
        {tab === "info" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <KVItem label="需求部門" value={p.requestDept} />
              <KVItem label="聯繫人" value={p.requestContact} />
              <KVItem label="年度" value={String(p.year)} />
              <KVItem label="類別" value={p.category} />
              <KVItem label="負責人 (PM)" value={p.owner.name} />
              <KVItem label="開發單位" value={p.devDept} />
              <KVItem label="廠商" value={p.vendor} />
              <KVItem
                label="廠商金額"
                value={
                  p.vendorAmount != null
                    ? `NT$ ${fmtNum(p.vendorAmount)}`
                    : null
                }
              />
              <KVItem label="計劃開始" value={fmtDate(p.plannedStart)} />
              <KVItem label="計劃結束" value={fmtDate(p.plannedEnd)} />
              <KVItem label="實際開始" value={fmtDate(p.actualStart)} />
              <KVItem label="實際結束" value={fmtDate(p.actualEnd)} />
              <KVItem
                label="效益總分"
                value={
                  p.benefitScore != null ? `${p.benefitScore}/100` : null
                }
              />
            </div>
            {p.businessGoal && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">業務目標</p>
                <p className="text-sm text-foreground whitespace-pre-wrap bg-accent/30 rounded-md p-3">
                  {p.businessGoal}
                </p>
              </div>
            )}
            {p.description && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">項目說明</p>
                <p className="text-sm text-foreground whitespace-pre-wrap bg-accent/30 rounded-md p-3">
                  {p.description}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Benefit */}
        {tab === "benefit" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <ScoreCard label="營收增長/成本節省" value={p.benefitRevenue} max={25} />
              <ScoreCard label="法規遵循/監管要求" value={p.benefitCompliance} max={25} />
              <ScoreCard label="營運效率提升" value={p.benefitEfficiency} max={25} />
              <ScoreCard label="風險控制/降低" value={p.benefitRisk} max={25} />
            </div>
            <div className="bg-accent/30 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold tabular-nums">
                {p.benefitScore ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">效益總分 / 100</p>
            </div>
            {p.benefitNote && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">效益說明</p>
                <p className="text-sm whitespace-pre-wrap">{p.benefitNote}</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Feasibility */}
        {tab === "feasibility" && (
          <div className="space-y-3">
            <div className="flex gap-3 flex-wrap">
              <SimpleBadge label="結論" value={p.feasibility ?? "PENDING"} />
              <SimpleBadge label="技術複雜度" value={p.techComplexity ?? "—"} />
              <SimpleBadge label="風險等級" value={p.riskLevel ?? "—"} />
            </div>
            {p.feasibilityNote && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">可行性分析</p>
                <p className="text-sm whitespace-pre-wrap bg-accent/30 rounded-md p-3">
                  {p.feasibilityNote}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Man-days & Budget */}
        {tab === "manday" && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">各階段人天</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border/50">
                    <th className="text-left py-2 font-medium">階段</th>
                    <th className="text-right py-2 font-medium">預估</th>
                    <th className="text-right py-2 font-medium">實際</th>
                    <th className="text-right py-2 font-medium">差異</th>
                  </tr>
                </thead>
                <tbody>
                  {MD_STAGES.map(({ key, label }) => {
                    const est = getNumField(p, key);
                    return (
                      <tr key={key} className="border-b border-border/30 hover:bg-accent/30">
                        <td className="py-2">{label}</td>
                        <td className="py-2 text-right tabular-nums">{est}</td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">—</td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">—</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-medium border-t-2 border-border">
                    <td className="py-2">合計</td>
                    <td className="py-2 text-right tabular-nums">{fmtNum(p.mdTotalEstimated)}</td>
                    <td className="py-2 text-right tabular-nums">{fmtNum(p.mdActualTotal)}</td>
                    <td
                      className={cn(
                        "py-2 text-right tabular-nums",
                        (p.mdActualTotal ?? 0) > (p.mdTotalEstimated ?? 0) ? "text-red-500" : ""
                      )}
                    >
                      {p.mdActualTotal != null && p.mdTotalEstimated != null
                        ? fmtNum(p.mdActualTotal - p.mdTotalEstimated)
                        : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">預算摘要</p>
              <div className="space-y-2">
                {BUDGET_FIELDS.map(({ key, label }) => (
                  <div
                    key={key}
                    className="flex justify-between text-sm py-1.5 border-b border-border/30"
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span className="tabular-nums">
                      NT$ {fmtNum(getNumField(p, key) || null)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-medium pt-2 border-t-2 border-border">
                  <span>總預算</span>
                  <span className="tabular-nums">NT$ {fmtNum(p.budgetTotal)}</span>
                </div>
                {p.budgetActual != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">實際花費</span>
                    <span
                      className={cn(
                        "tabular-nums",
                        (p.budgetActual ?? 0) > (p.budgetTotal ?? 0) ? "text-red-500" : ""
                      )}
                    >
                      NT$ {fmtNum(p.budgetActual)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Schedule */}
        {tab === "schedule" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <KVItem label="計劃開始" value={fmtDate(p.plannedStart)} />
              <KVItem label="計劃結束" value={fmtDate(p.plannedEnd)} />
              <KVItem label="實際開始" value={fmtDate(p.actualStart)} />
              <KVItem label="實際結束" value={fmtDate(p.actualEnd)} />
              <KVItem label="上線日期" value={fmtDate(p.goLiveDate)} />
              <KVItem label="保固到期" value={fmtDate(p.warrantyEndDate)} />
            </div>
          </div>
        )}

        {/* Tab 6: Progress */}
        {tab === "progress" && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">狀態流程</p>
              <div className="flex flex-wrap gap-1">
                {STATUS_FLOW.map((s, i) => {
                  const isCurrent = p.status === s;
                  const isPast = STATUS_FLOW.indexOf(p.status) > i;
                  return (
                    <div key={s} className="flex items-center">
                      <span
                        className={cn(
                          "px-2 py-1 rounded text-[10px] font-medium border transition-all",
                          isCurrent
                            ? "bg-primary text-primary-foreground border-primary"
                            : isPast
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                              : "bg-muted text-muted-foreground border-border"
                        )}
                      >
                        {STATUS_LABELS[s] ?? s}
                      </span>
                      {i < STATUS_FLOW.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-muted-foreground mx-0.5 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
              {(p.status === "ON_HOLD" || p.status === "CANCELLED") && (
                <div className="mt-2">
                  <StatusBadge status={p.status} />
                </div>
              )}
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-muted-foreground">進度</span>
                <span className="text-sm font-medium tabular-nums">{p.progressPct}%</span>
              </div>
              <div className="h-2 w-full bg-accent rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(p.progressPct, 100)}%` }}
                />
              </div>
            </div>

            {p.progressNote && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">最新進展</p>
                <p className="text-sm whitespace-pre-wrap bg-accent/30 rounded-md p-3">
                  {p.progressNote}
                </p>
              </div>
            )}
            {p.blockers && (
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  阻礙
                </p>
                <p className="text-sm whitespace-pre-wrap bg-amber-500/5 border border-amber-500/20 rounded-md p-3">
                  {p.blockers}
                </p>
              </div>
            )}
            {p.nextSteps && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">下一步</p>
                <p className="text-sm whitespace-pre-wrap bg-accent/30 rounded-md p-3">
                  {p.nextSteps}
                </p>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              關聯任務: {p._count.tasks} 項
            </div>
          </div>
        )}

        {/* Tab 7: Stakeholders */}
        {tab === "stakeholder" && (
          <div className="space-y-4">
            <StakeholderMatrix stakeholders={p.stakeholders} />
            <div>
              <p className="text-sm font-medium mb-3">
                利害關係人清單（{p.stakeholders.length}）
              </p>
              {p.stakeholders.length === 0 ? (
                <p className="text-sm text-muted-foreground">尚無利害關係人記錄</p>
              ) : (
                <div className="space-y-2">
                  {p.stakeholders.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 p-3 bg-accent/30 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{s.name}</p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                          {s.department && <span>{s.department}</span>}
                          {s.role && <span>{s.role}</span>}
                          {s.influence && <span>影響力:{s.influence}</span>}
                          {s.interest && <span>關注度:{s.interest}</span>}
                          {s.engagement && (
                            <span className={cn(
                              "px-1.5 py-0.5 rounded-full",
                              s.engagement === "CHAMPION" ? "bg-emerald-500/10 text-emerald-500" :
                              s.engagement === "SUPPORTER" ? "bg-blue-500/10 text-blue-500" :
                              s.engagement === "RESISTANT" ? "bg-red-500/10 text-red-500" :
                              "bg-gray-500/10 text-gray-400"
                            )}>
                              {s.engagement}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 8: Risks & Issues */}
        {tab === "risk" && (
          <div className="space-y-6">
            {/* Risks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-orange-500" />
                  風險（{p.risks.length}）
                </p>
                {isManager && (
                  <button
                    onClick={() => setShowRiskForm((v) => !v)}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    新增
                  </button>
                )}
              </div>
              {showRiskForm && (
                <div className="bg-accent/30 rounded-lg p-3 mb-3 space-y-2">
                  <input
                    type="text"
                    placeholder="風險名稱"
                    value={riskForm.title}
                    onChange={(e) => setRiskForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full px-3 py-1.5 text-sm border border-border rounded bg-background"
                  />
                  <div className="flex gap-2">
                    <select
                      value={riskForm.probability}
                      onChange={(e) => setRiskForm((f) => ({ ...f, probability: e.target.value }))}
                      className="flex-1 px-2 py-1.5 text-sm border border-border rounded bg-background"
                    >
                      <option value="LOW">機率-低</option>
                      <option value="MEDIUM">機率-中</option>
                      <option value="HIGH">機率-高</option>
                      <option value="VERY_HIGH">機率-極高</option>
                    </select>
                    <select
                      value={riskForm.impact}
                      onChange={(e) => setRiskForm((f) => ({ ...f, impact: e.target.value }))}
                      className="flex-1 px-2 py-1.5 text-sm border border-border rounded bg-background"
                    >
                      <option value="LOW">影響-低</option>
                      <option value="MEDIUM">影響-中</option>
                      <option value="HIGH">影響-高</option>
                      <option value="CRITICAL">影響-極高</option>
                    </select>
                  </div>
                  <select
                    value={riskForm.ownerId}
                    onChange={(e) => setRiskForm((f) => ({ ...f, ownerId: e.target.value }))}
                    className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background"
                  >
                    <option value="">選擇負責人</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowRiskForm(false)}
                      className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      取消
                    </button>
                    <button
                      onClick={createRisk}
                      className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                    >
                      確認
                    </button>
                  </div>
                </div>
              )}
              {p.risks.length === 0 ? (
                <p className="text-sm text-muted-foreground">尚無風險記錄</p>
              ) : (
                <div className="space-y-2">
                  {p.risks.map((r) => (
                    <div key={r.id} className="flex items-start gap-3 p-3 bg-accent/30 rounded-lg">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-medium",
                          RISK_SCORE_COLOR(r.riskScore)
                        )}
                      >
                        {r.riskScore}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{r.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                          <span>{r.code}</span>
                          <span>{r.probability}/{r.impact}</span>
                          <span>{r.owner.name}</span>
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded-full",
                              r.status === "OPEN"
                                ? "bg-red-500/10 text-red-500"
                                : r.status === "CLOSED"
                                  ? "bg-emerald-500/10 text-emerald-500"
                                  : "bg-yellow-500/10 text-yellow-500"
                            )}
                          >
                            {r.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Issues */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  議題（{p.issues.length}）
                </p>
                {isManager && (
                  <button
                    onClick={() => setShowIssueForm((v) => !v)}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    新增
                  </button>
                )}
              </div>
              {showIssueForm && (
                <div className="bg-accent/30 rounded-lg p-3 mb-3 space-y-2">
                  <input
                    type="text"
                    placeholder="議題名稱"
                    value={issueForm.title}
                    onChange={(e) => setIssueForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full px-3 py-1.5 text-sm border border-border rounded bg-background"
                  />
                  <div className="flex gap-2">
                    <select
                      value={issueForm.severity}
                      onChange={(e) => setIssueForm((f) => ({ ...f, severity: e.target.value }))}
                      className="flex-1 px-2 py-1.5 text-sm border border-border rounded bg-background"
                    >
                      <option value="LOW">嚴重度-低</option>
                      <option value="MEDIUM">嚴重度-中</option>
                      <option value="HIGH">嚴重度-高</option>
                      <option value="CRITICAL">嚴重度-極高</option>
                    </select>
                    <select
                      value={issueForm.assigneeId}
                      onChange={(e) => setIssueForm((f) => ({ ...f, assigneeId: e.target.value }))}
                      className="flex-1 px-2 py-1.5 text-sm border border-border rounded bg-background"
                    >
                      <option value="">選擇負責人</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowIssueForm(false)}
                      className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      取消
                    </button>
                    <button
                      onClick={createIssue}
                      className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                    >
                      確認
                    </button>
                  </div>
                </div>
              )}
              {p.issues.length === 0 ? (
                <p className="text-sm text-muted-foreground">尚無議題記錄</p>
              ) : (
                <div className="space-y-2">
                  {p.issues.map((iss) => (
                    <div key={iss.id} className="flex items-start gap-3 p-3 bg-accent/30 rounded-lg">
                      <span
                        className={cn(
                          "text-[11px] font-medium",
                          SEVERITY_COLORS[iss.severity] ?? "text-muted-foreground"
                        )}
                      >
                        {iss.severity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{iss.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                          <span>{iss.code}</span>
                          <span>{iss.assignee.name}</span>
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded-full",
                              iss.status === "OPEN"
                                ? "bg-red-500/10 text-red-500"
                                : iss.status === "RESOLVED"
                                  ? "bg-emerald-500/10 text-emerald-500"
                                  : "bg-yellow-500/10 text-yellow-500"
                            )}
                          >
                            {iss.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 9: Gate Review */}
        {tab === "gate" && (
          <div className="space-y-4">
            {p.gates.map((gate) => (
              <GateCard
                key={gate.id}
                gate={gate}
                isManager={isManager}
                onUpdate={(data) => updateGate(gate.id, data)}
              />
            ))}
          </div>
        )}

        {/* Tab 10: Post Review */}
        {tab === "review" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <ScoreCard label="時程達成" value={p.postReviewSchedule} max={25} />
              <ScoreCard label="品質達成" value={p.postReviewQuality} max={25} />
              <ScoreCard label="預算控制" value={p.postReviewBudget} max={25} />
              <ScoreCard label="用戶滿意度" value={p.postReviewSatisfy} max={25} />
            </div>
            {p.postReviewScore != null && (
              <div className="bg-accent/30 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold tabular-nums">{p.postReviewScore}</p>
                <p className="text-xs text-muted-foreground mt-1">後評價總分 / 100</p>
              </div>
            )}
            {p.postReviewNote && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">後評價說明</p>
                <p className="text-sm whitespace-pre-wrap">{p.postReviewNote}</p>
              </div>
            )}
            {p.lessonsLearned && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">經驗教訓</p>
                <p className="text-sm whitespace-pre-wrap">{p.lessonsLearned}</p>
              </div>
            )}
            {p.improvements && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">改善建議</p>
                <p className="text-sm whitespace-pre-wrap">{p.improvements}</p>
              </div>
            )}
            {p.postReviewScore == null && (
              <p className="text-sm text-muted-foreground text-center py-8">
                尚未進行後評價
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
