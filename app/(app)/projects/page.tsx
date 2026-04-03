"use client";

/**
 * PMO Project Management Page — Issue #1168
 *
 * Features:
 * - Project list with filters, search, sorting, pagination
 * - Dashboard summary bar (total / on-track / at-risk / overdue / gate-blocked)
 * - Multi-step create/edit modal (4 steps)
 * - Detail side panel with 9 tabs (5 full + 4 simple)
 * - Risk & Issue inline management
 * - Gate Review with checklist + pass/block actions
 * - CSV export
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  FolderKanban,
  Plus,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Check,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";

// ── Types ──────────────────────────────────────────────────────────────────

interface ProjectListItem {
  id: string;
  code: string;
  year: number;
  name: string;
  category: string | null;
  requestDept: string;
  status: string;
  priority: string;
  benefitScore: number | null;
  mdTotalEstimated: number | null;
  mdActualTotal: number | null;
  progressPct: number;
  plannedEnd: string | null;
  owner: { id: string; name: string; avatar?: string | null };
  _count: {
    risks: number;
    issues: number;
    stakeholders: number;
    gates: number;
    tasks: number;
  };
}

interface ProjectDetail {
  id: string;
  code: string;
  year: number;
  name: string;
  description: string | null;
  category: string | null;
  subCategory: string | null;
  tags: string[];
  requestDept: string;
  requestContact: string | null;
  requestPhone: string | null;
  requestDate: string | null;
  businessGoal: string | null;
  coDepts: string[];
  coContacts: string[];
  devDept: string | null;
  ownerId: string;
  leadDevId: string | null;
  teamMembers: string[];
  benefitRevenue: number | null;
  benefitCompliance: number | null;
  benefitEfficiency: number | null;
  benefitRisk: number | null;
  benefitScore: number | null;
  benefitNote: string | null;
  priority: string;
  urgency: string | null;
  strategicAlign: number | null;
  priorityScore: number | null;
  feasibility: string | null;
  feasibilityNote: string | null;
  techComplexity: string | null;
  riskLevel: string | null;
  mdProjectMgmt: number | null;
  mdRequirements: number | null;
  mdDesign: number | null;
  mdDevelopment: number | null;
  mdTesting: number | null;
  mdDeployment: number | null;
  mdDocumentation: number | null;
  mdTraining: number | null;
  mdMaintenance: number | null;
  mdOther: number | null;
  mdTotalEstimated: number | null;
  mdActualTotal: number | null;
  budgetInternal: number | null;
  budgetExternal: number | null;
  budgetHardware: number | null;
  budgetLicense: number | null;
  budgetOther: number | null;
  budgetTotal: number | null;
  budgetActual: number | null;
  costPerManDay: number | null;
  vendor: string | null;
  vendorContact: string | null;
  vendorContract: string | null;
  vendorAmount: number | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  goLiveDate: string | null;
  warrantyEndDate: string | null;
  status: string;
  phase: string | null;
  progressPct: number;
  progressNote: string | null;
  blockers: string | null;
  nextSteps: string | null;
  currentGate: string | null;
  gateStatus: string | null;
  postReviewSchedule: number | null;
  postReviewQuality: number | null;
  postReviewBudget: number | null;
  postReviewSatisfy: number | null;
  postReviewScore: number | null;
  postReviewNote: string | null;
  lessonsLearned: string | null;
  improvements: string | null;
  owner: { id: string; name: string; avatar?: string | null };
  risks: ProjectRisk[];
  issues: ProjectIssue[];
  stakeholders: ProjectStakeholder[];
  gates: ProjectGate[];
  _count: { tasks: number };
}

interface ProjectRisk {
  id: string;
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  probability: string;
  impact: string;
  riskScore: number;
  mitigation: string | null;
  contingency: string | null;
  status: string;
  dueDate: string | null;
  owner: { id: string; name: string };
}

interface ProjectIssue {
  id: string;
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  severity: string;
  status: string;
  resolution: string | null;
  dueDate: string | null;
  source: string | null;
  assignee: { id: string; name: string };
}

interface ProjectStakeholder {
  id: string;
  name: string;
  department: string | null;
  role: string | null;
  influence: string | null;
  interest: string | null;
  engagement: string | null;
}

interface ChecklistItem {
  item: string;
  checked: boolean;
  note: string;
}

interface ProjectGate {
  id: string;
  name: string;
  phase: string;
  order: number;
  checklist: ChecklistItem[];
  checklistPassed: boolean;
  status: string;
  reviewerId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  blockerNote: string | null;
  waiverReason: string | null;
  reviewer: { id: string; name: string } | null;
}

interface DashboardStats {
  year: number;
  total: number;
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  byDept: { dept: string; count: number }[];
  avgProgress: number;
  openRisks: number;
  openIssues: number;
}

interface UserOption {
  id: string;
  name: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  PROPOSED: "提案",
  EVALUATING: "評估中",
  APPROVED: "已核准",
  SCHEDULED: "已排程",
  REQUIREMENTS: "需求分析",
  DESIGN: "系統設計",
  DEVELOPMENT: "開發中",
  TESTING: "測試中",
  DEPLOYMENT: "部署中",
  WARRANTY: "保固期",
  COMPLETED: "已完成",
  POST_REVIEW: "後評價",
  CLOSED: "已關閉",
  ON_HOLD: "暫停",
  CANCELLED: "已取消",
};

const STATUS_COLORS: Record<string, string> = {
  PROPOSED:
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  EVALUATING:
    "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  APPROVED:
    "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
  SCHEDULED:
    "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400",
  REQUIREMENTS:
    "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
  DESIGN:
    "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
  DEVELOPMENT:
    "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
  TESTING:
    "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
  DEPLOYMENT:
    "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
  WARRANTY:
    "bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400",
  COMPLETED:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  POST_REVIEW:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  CLOSED: "bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
  ON_HOLD:
    "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-400",
  CANCELLED:
    "bg-red-200 text-red-500 dark:bg-red-900/40 dark:text-red-500",
};

const PRIORITY_LABELS: Record<string, string> = {
  P0: "P0 緊急",
  P1: "P1 高",
  P2: "P2 中",
  P3: "P3 低",
};

const PRIORITY_COLORS: Record<string, string> = {
  P0: "text-red-500",
  P1: "text-orange-500",
  P2: "text-blue-500",
  P3: "text-gray-400",
};

const RISK_SCORE_COLOR = (score: number) => {
  if (score >= 12) return "bg-red-500/10 text-red-500";
  if (score >= 8) return "bg-orange-500/10 text-orange-500";
  if (score >= 4) return "bg-yellow-500/10 text-yellow-600";
  return "bg-emerald-500/10 text-emerald-500";
};

const SEVERITY_COLORS: Record<string, string> = {
  LOW: "text-emerald-500",
  MEDIUM: "text-yellow-500",
  HIGH: "text-orange-500",
  CRITICAL: "text-red-500",
};

const GATE_STATUS_COLORS: Record<string, string> = {
  PENDING: "border-border bg-muted text-muted-foreground",
  PASSED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  BLOCKED: "border-red-500/30 bg-red-500/10 text-red-500",
  WAIVED: "border-amber-500/30 bg-amber-500/10 text-amber-500",
};

const STATUS_FLOW = [
  "PROPOSED",
  "EVALUATING",
  "APPROVED",
  "SCHEDULED",
  "REQUIREMENTS",
  "DESIGN",
  "DEVELOPMENT",
  "TESTING",
  "DEPLOYMENT",
  "WARRANTY",
  "COMPLETED",
  "POST_REVIEW",
  "CLOSED",
];

const MD_STAGES = [
  { key: "mdProjectMgmt", label: "專案管理" },
  { key: "mdRequirements", label: "需求分析" },
  { key: "mdDesign", label: "系統設計/架構" },
  { key: "mdDevelopment", label: "程式開發" },
  { key: "mdTesting", label: "測試(SIT+UAT)" },
  { key: "mdDeployment", label: "部署上線" },
  { key: "mdDocumentation", label: "文件撰寫" },
  { key: "mdTraining", label: "教育訓練" },
  { key: "mdMaintenance", label: "維護保固" },
  { key: "mdOther", label: "其他" },
] as const;

const BUDGET_FIELDS = [
  { key: "budgetInternal", label: "內部人力" },
  { key: "budgetExternal", label: "外部委外" },
  { key: "budgetHardware", label: "硬體/設備" },
  { key: "budgetLicense", label: "軟體授權" },
  { key: "budgetOther", label: "其他" },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return d.split("T")[0];
}

function fmtNum(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("zh-TW");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNumField(obj: any, key: string): number {
  return (obj?.[key] as number) ?? 0;
}

// ── Dashboard Summary Bar ──────────────────────────────────────────────────

function DashboardBar({ stats }: { stats: DashboardStats | null }) {
  if (!stats) return null;

  const onTrack = stats.byStatus
    .filter((s) =>
      [
        "REQUIREMENTS",
        "DESIGN",
        "DEVELOPMENT",
        "TESTING",
        "DEPLOYMENT",
        "WARRANTY",
        "SCHEDULED",
      ].includes(s.status)
    )
    .reduce((acc, s) => acc + s.count, 0);

  const gateBlocked =
    stats.byStatus.find((s) => s.status === "ON_HOLD")?.count ?? 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      <div className="bg-card rounded-xl shadow-card p-4 text-center">
        <p className="text-2xl font-semibold tabular-nums">{stats.total}</p>
        <p className="text-xs text-muted-foreground mt-1">項目總數</p>
      </div>
      <div className="bg-card rounded-xl shadow-card p-4 text-center">
        <p className="text-2xl font-semibold tabular-nums text-emerald-500">
          {onTrack}
        </p>
        <p className="text-xs text-muted-foreground mt-1">進行中</p>
      </div>
      <div className="bg-card rounded-xl shadow-card p-4 text-center">
        <p className="text-2xl font-semibold tabular-nums text-orange-500">
          {stats.openRisks}
        </p>
        <p className="text-xs text-muted-foreground mt-1">未結風險</p>
      </div>
      <div className="bg-card rounded-xl shadow-card p-4 text-center">
        <p className="text-2xl font-semibold tabular-nums">
          {stats.avgProgress}%
        </p>
        <p className="text-xs text-muted-foreground mt-1">平均進度</p>
      </div>
      <div className="bg-card rounded-xl shadow-card p-4 text-center">
        <p className="text-2xl font-semibold tabular-nums text-amber-500">
          {gateBlocked}
        </p>
        <p className="text-xs text-muted-foreground mt-1">暫停中</p>
      </div>
    </div>
  );
}

// ── Status Badge ───────────────────────────────────────────────────────────

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

// ── Create/Edit Modal ──────────────────────────────────────────────────────

interface CreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  users: UserOption[];
}

function CreateProjectModal({
  open,
  onClose,
  onCreated,
  users,
}: CreateModalProps) {
  const currentYear = new Date().getFullYear();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setField("category", e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="如：一行一策"
                  />
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

// ── Detail Panel ───────────────────────────────────────────────────────────

interface DetailPanelProps {
  projectId: string;
  onClose: () => void;
  isManager: boolean;
  users: UserOption[];
  onRefreshList: () => void;
}

const DETAIL_TABS = [
  { key: "info", label: "基本資訊" },
  { key: "benefit", label: "效益" },
  { key: "feasibility", label: "可行性" },
  { key: "manday", label: "人天與預算" },
  { key: "schedule", label: "排期" },
  { key: "progress", label: "進展" },
  { key: "risk", label: "風險與議題" },
  { key: "gate", label: "Gate Review" },
  { key: "review", label: "後評價" },
];

function DetailPanel({
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
      setRiskForm({
        title: "",
        probability: "MEDIUM",
        impact: "MEDIUM",
        ownerId: "",
      });
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
              <KVItem
                label="優先級"
                value={PRIORITY_LABELS[p.priority] ?? p.priority}
              />
              <KVItem
                label="效益總分"
                value={
                  p.benefitScore != null ? `${p.benefitScore}/100` : null
                }
              />
              <KVItem label="計劃開始" value={fmtDate(p.plannedStart)} />
              <KVItem label="計劃結束" value={fmtDate(p.plannedEnd)} />
              <KVItem label="實際開始" value={fmtDate(p.actualStart)} />
              <KVItem label="實際結束" value={fmtDate(p.actualEnd)} />
              <KVItem label="廠商" value={p.vendor} />
              <KVItem
                label="廠商金額"
                value={
                  p.vendorAmount != null
                    ? `NT$ ${fmtNum(p.vendorAmount)}`
                    : null
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
              <ScoreCard
                label="營收增長/成本節省"
                value={p.benefitRevenue}
                max={25}
              />
              <ScoreCard
                label="法規遵循/監管要求"
                value={p.benefitCompliance}
                max={25}
              />
              <ScoreCard
                label="營運效率提升"
                value={p.benefitEfficiency}
                max={25}
              />
              <ScoreCard
                label="風險控制/降低"
                value={p.benefitRisk}
                max={25}
              />
            </div>
            <div className="bg-accent/30 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold tabular-nums">
                {p.benefitScore ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                效益總分 / 100
              </p>
            </div>
            {p.benefitNote && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">效益說明</p>
                <p className="text-sm whitespace-pre-wrap">
                  {p.benefitNote}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Feasibility */}
        {tab === "feasibility" && (
          <div className="space-y-3">
            <div className="flex gap-3 flex-wrap">
              <SimpleBadge
                label="結論"
                value={p.feasibility ?? "PENDING"}
              />
              <SimpleBadge
                label="技術複雜度"
                value={p.techComplexity ?? "—"}
              />
              <SimpleBadge label="風險等級" value={p.riskLevel ?? "—"} />
            </div>
            {p.feasibilityNote && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  可行性分析
                </p>
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
                      <tr
                        key={key}
                        className="border-b border-border/30 hover:bg-accent/30"
                      >
                        <td className="py-2">{label}</td>
                        <td className="py-2 text-right tabular-nums">
                          {est}
                        </td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          —
                        </td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          —
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-medium border-t-2 border-border">
                    <td className="py-2">合計</td>
                    <td className="py-2 text-right tabular-nums">
                      {fmtNum(p.mdTotalEstimated)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {fmtNum(p.mdActualTotal)}
                    </td>
                    <td
                      className={cn(
                        "py-2 text-right tabular-nums",
                        (p.mdActualTotal ?? 0) > (p.mdTotalEstimated ?? 0)
                          ? "text-red-500"
                          : ""
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
                  <span className="tabular-nums">
                    NT$ {fmtNum(p.budgetTotal)}
                  </span>
                </div>
                {p.budgetActual != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">實際花費</span>
                    <span
                      className={cn(
                        "tabular-nums",
                        (p.budgetActual ?? 0) > (p.budgetTotal ?? 0)
                          ? "text-red-500"
                          : ""
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
              <KVItem
                label="保固到期"
                value={fmtDate(p.warrantyEndDate)}
              />
            </div>
          </div>
        )}

        {/* Tab 6: Progress */}
        {tab === "progress" && (
          <div className="space-y-4">
            {/* Status flow diagram */}
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

            {/* Progress bar */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-muted-foreground">進度</span>
                <span className="text-sm font-medium tabular-nums">
                  {p.progressPct}%
                </span>
              </div>
              <div className="h-2 w-full bg-accent rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(p.progressPct, 100)}%`,
                  }}
                />
              </div>
            </div>

            {p.progressNote && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  最新進展
                </p>
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

        {/* Tab 7: Risks & Issues */}
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
                    onChange={(e) =>
                      setRiskForm((f) => ({
                        ...f,
                        title: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-1.5 text-sm border border-border rounded bg-background"
                  />
                  <div className="flex gap-2">
                    <select
                      value={riskForm.probability}
                      onChange={(e) =>
                        setRiskForm((f) => ({
                          ...f,
                          probability: e.target.value,
                        }))
                      }
                      className="flex-1 px-2 py-1.5 text-sm border border-border rounded bg-background"
                    >
                      <option value="LOW">機率-低</option>
                      <option value="MEDIUM">機率-中</option>
                      <option value="HIGH">機率-高</option>
                      <option value="VERY_HIGH">機率-極高</option>
                    </select>
                    <select
                      value={riskForm.impact}
                      onChange={(e) =>
                        setRiskForm((f) => ({
                          ...f,
                          impact: e.target.value,
                        }))
                      }
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
                    onChange={(e) =>
                      setRiskForm((f) => ({
                        ...f,
                        ownerId: e.target.value,
                      }))
                    }
                    className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background"
                  >
                    <option value="">選擇負責人</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
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
                <p className="text-sm text-muted-foreground">
                  尚無風險記錄
                </p>
              ) : (
                <div className="space-y-2">
                  {p.risks.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-start gap-3 p-3 bg-accent/30 rounded-lg"
                    >
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
                          <span>
                            {r.probability}/{r.impact}
                          </span>
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
                    onChange={(e) =>
                      setIssueForm((f) => ({
                        ...f,
                        title: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-1.5 text-sm border border-border rounded bg-background"
                  />
                  <div className="flex gap-2">
                    <select
                      value={issueForm.severity}
                      onChange={(e) =>
                        setIssueForm((f) => ({
                          ...f,
                          severity: e.target.value,
                        }))
                      }
                      className="flex-1 px-2 py-1.5 text-sm border border-border rounded bg-background"
                    >
                      <option value="LOW">嚴重度-低</option>
                      <option value="MEDIUM">嚴重度-中</option>
                      <option value="HIGH">嚴重度-高</option>
                      <option value="CRITICAL">嚴重度-極高</option>
                    </select>
                    <select
                      value={issueForm.assigneeId}
                      onChange={(e) =>
                        setIssueForm((f) => ({
                          ...f,
                          assigneeId: e.target.value,
                        }))
                      }
                      className="flex-1 px-2 py-1.5 text-sm border border-border rounded bg-background"
                    >
                      <option value="">選擇負責人</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
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
                <p className="text-sm text-muted-foreground">
                  尚無議題記錄
                </p>
              ) : (
                <div className="space-y-2">
                  {p.issues.map((iss) => (
                    <div
                      key={iss.id}
                      className="flex items-start gap-3 p-3 bg-accent/30 rounded-lg"
                    >
                      <span
                        className={cn(
                          "text-[11px] font-medium",
                          SEVERITY_COLORS[iss.severity] ??
                            "text-muted-foreground"
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

        {/* Tab 8: Gate Review */}
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

        {/* Tab 9: Post Review */}
        {tab === "review" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <ScoreCard
                label="時程達成"
                value={p.postReviewSchedule}
                max={25}
              />
              <ScoreCard
                label="品質達成"
                value={p.postReviewQuality}
                max={25}
              />
              <ScoreCard
                label="預算控制"
                value={p.postReviewBudget}
                max={25}
              />
              <ScoreCard
                label="用戶滿意度"
                value={p.postReviewSatisfy}
                max={25}
              />
            </div>
            {p.postReviewScore != null && (
              <div className="bg-accent/30 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold tabular-nums">
                  {p.postReviewScore}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  後評價總分 / 100
                </p>
              </div>
            )}
            {p.postReviewNote && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  後評價說明
                </p>
                <p className="text-sm whitespace-pre-wrap">
                  {p.postReviewNote}
                </p>
              </div>
            )}
            {p.lessonsLearned && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  經驗教訓
                </p>
                <p className="text-sm whitespace-pre-wrap">
                  {p.lessonsLearned}
                </p>
              </div>
            )}
            {p.improvements && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  改善建議
                </p>
                <p className="text-sm whitespace-pre-wrap">
                  {p.improvements}
                </p>
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

  useEffect(() => {
    setLocalChecklist(
      Array.isArray(gate.checklist) ? gate.checklist : []
    );
  }, [gate.checklist]);

  function toggleItem(index: number) {
    const updated = localChecklist.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    );
    setLocalChecklist(updated);
    onUpdate({ checklist: updated });
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

// ── Small components ───────────────────────────────────────────────────────

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

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { data: session } = useSession();
  const isManager =
    session?.user?.role === "MANAGER" || session?.user?.role === "ADMIN";

  const currentYear = new Date().getFullYear();

  // List state
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [statusFilter, setStatusFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [search, setSearch] = useState("");

  // Sorting
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Modal / Panel
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );

  // Dashboard
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // Users for forms
  const [users, setUsers] = useState<UserOption[]>([]);

  // Fetch users
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((body) => {
        const list = Array.isArray(body?.data)
          ? body.data
          : Array.isArray(body)
            ? body
            : [];
        setUsers(
          list.map((u: { id: string; name: string }) => ({
            id: u.id,
            name: u.name,
          }))
        );
      })
      .catch(() => {});
  }, []);

  // Fetch dashboard stats
  useEffect(() => {
    fetch(`/api/projects/dashboard?year=${yearFilter}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (body) => body && setStats(extractData<DashboardStats>(body))
      )
      .catch(() => {});
  }, [yearFilter]);

  // Fetch project list
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      if (yearFilter) params.set("year", yearFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (deptFilter) params.set("requestDept", deptFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (search.trim()) params.set("search", search.trim());
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      const res = await fetch(`/api/projects?${params}`);
      if (!res.ok) throw new Error("項目載入失敗");
      const body = await res.json();
      const data = extractData<{ items: ProjectListItem[]; total: number }>(
        body
      );
      setProjects(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [
    yearFilter,
    statusFilter,
    deptFilter,
    priorityFilter,
    search,
    page,
    limit,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Export (CSV or Excel)
  async function handleExport(type?: "full" | "summary") {
    const params = new URLSearchParams();
    if (yearFilter) params.set("year", yearFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (deptFilter) params.set("requestDept", deptFilter);
    if (type) params.set("type", type);

    const res = await fetch(`/api/projects/export?${params}`);
    if (!res.ok) {
      toast.error("匯出失敗");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStr = new Date().toISOString().split("T")[0];
    if (type) {
      a.download = `projects-${type}-${dateStr}.xlsx`;
    } else {
      a.download = `projects-${dateStr}.csv`;
    }
    a.click();
    URL.revokeObjectURL(url);
    toast.success(type ? "Excel 已匯出" : "CSV 已匯出");
  }

  const [showExportMenu, setShowExportMenu] = useState(false);

  // Sort toggle
  function toggleSort(col: string) {
    if (sortBy === col) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortOrder("asc");
    }
    setPage(1);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-primary" />
            項目管理
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            PMO 企業級項目全生命週期管理
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-background border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              匯出
            </button>
            {showExportMenu && (
              <div className="absolute top-full mt-1 right-0 z-50 w-48 bg-card border border-border rounded-lg shadow-xl p-1">
                <button
                  onClick={() => { handleExport("full"); setShowExportMenu(false); }}
                  className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent/50 transition-colors"
                >
                  Excel 完整版
                </button>
                <button
                  onClick={() => { handleExport("summary"); setShowExportMenu(false); }}
                  className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent/50 transition-colors"
                >
                  Excel 摘要版
                </button>
                <div className="border-t border-border my-1" />
                <button
                  onClick={() => { handleExport(); setShowExportMenu(false); }}
                  className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent/50 transition-colors text-muted-foreground"
                >
                  CSV
                </button>
              </div>
            )}
          </div>
          {isManager && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-primary text-primary-foreground rounded-lg shadow-sm transition-all hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              新增項目
            </button>
          )}
        </div>
      </div>

      {/* Dashboard summary */}
      <DashboardBar stats={stats} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
        <select
          value={yearFilter}
          onChange={(e) => {
            setYearFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm border border-border rounded-md bg-background"
        >
          {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map(
            (y) => (
              <option key={y} value={y}>
                {y}
              </option>
            )
          )}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm border border-border rounded-md bg-background"
        >
          <option value="">全部狀態</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => {
            setPriorityFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm border border-border rounded-md bg-background"
        >
          <option value="">全部優先級</option>
          <option value="P0">P0 緊急</option>
          <option value="P1">P1 高</option>
          <option value="P2">P2 中</option>
          <option value="P3">P3 低</option>
        </select>
        <input
          type="text"
          value={deptFilter}
          onChange={(e) => {
            setDeptFilter(e.target.value);
            setPage(1);
          }}
          placeholder="需求部門"
          className="px-3 py-2 text-sm border border-border rounded-md bg-background w-28"
        />
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="搜尋名稱或編號..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <PageLoading message="載入項目..." />
      ) : fetchError ? (
        <PageError message={fetchError} onRetry={fetchProjects} />
      ) : projects.length === 0 ? (
        <PageEmpty
          icon={<FolderKanban className="h-10 w-10" />}
          title="尚無項目"
          description={
            isManager
              ? "點擊「新增項目」建立第一個項目"
              : "目前沒有任何項目"
          }
        />
      ) : (
        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="text-xs text-muted-foreground border-b border-border">
                <SortHeader
                  label="編號"
                  col="code"
                  current={sortBy}
                  order={sortOrder}
                  onSort={toggleSort}
                />
                <th className="text-left py-3 px-3 font-medium">名稱</th>
                <th className="text-left py-3 px-3 font-medium">類別</th>
                <th className="text-left py-3 px-3 font-medium">
                  需求部門
                </th>
                <SortHeader
                  label="狀態"
                  col="status"
                  current={sortBy}
                  order={sortOrder}
                  onSort={toggleSort}
                />
                <SortHeader
                  label="優先級"
                  col="priority"
                  current={sortBy}
                  order={sortOrder}
                  onSort={toggleSort}
                />
                <th className="text-right py-3 px-3 font-medium">效益分</th>
                <th className="text-right py-3 px-3 font-medium">
                  預估人天
                </th>
                <th className="text-right py-3 px-3 font-medium">
                  實際人天
                </th>
                <SortHeader
                  label="進度%"
                  col="progressPct"
                  current={sortBy}
                  order={sortOrder}
                  onSort={toggleSort}
                  className="text-right"
                />
                <th className="text-left py-3 px-3 font-medium">負責人</th>
                <SortHeader
                  label="預計完成"
                  col="plannedEnd"
                  current={sortBy}
                  order={sortOrder}
                  onSort={toggleSort}
                />
              </tr>
            </thead>
            <tbody>
              {projects.map((proj) => (
                <tr
                  key={proj.id}
                  onClick={() => setSelectedProjectId(proj.id)}
                  className="border-b border-border/50 hover:bg-accent/30 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-3 font-mono text-xs text-muted-foreground">
                    {proj.code}
                  </td>
                  <td className="py-3 px-3 font-medium max-w-[200px] truncate">
                    {proj.name}
                  </td>
                  <td className="py-3 px-3 text-muted-foreground">
                    {proj.category ?? "—"}
                  </td>
                  <td className="py-3 px-3">{proj.requestDept}</td>
                  <td className="py-3 px-3">
                    <StatusBadge status={proj.status} />
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={cn(
                        "font-medium",
                        PRIORITY_COLORS[proj.priority] ?? ""
                      )}
                    >
                      {proj.priority}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {proj.benefitScore ?? "—"}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {fmtNum(proj.mdTotalEstimated)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {fmtNum(proj.mdActualTotal)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="h-1.5 w-16 bg-accent rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${Math.min(proj.progressPct, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="tabular-nums text-xs w-8 text-right">
                        {proj.progressPct}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3">{proj.owner.name}</td>
                  <td className="py-3 px-3 text-muted-foreground">
                    {fmtDate(proj.plannedEnd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between flex-shrink-0 text-sm">
          <span className="text-muted-foreground">共 {total} 個項目</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from(
              { length: Math.min(totalPages, 7) },
              (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-sm transition-colors",
                      page === pageNum
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent text-muted-foreground"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              }
            )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create modal */}
      <CreateProjectModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          fetchProjects();
        }}
        users={users}
      />

      {/* Detail panel */}
      {selectedProjectId && (
        <DetailPanel
          projectId={selectedProjectId}
          onClose={() => setSelectedProjectId(null)}
          isManager={isManager}
          users={users}
          onRefreshList={fetchProjects}
        />
      )}
    </div>
  );
}

// ── Sort Header ────────────────────────────────────────────────────────────

function SortHeader({
  label,
  col,
  current,
  order,
  onSort,
  className,
}: {
  label: string;
  col: string;
  current: string;
  order: "asc" | "desc";
  onSort: (col: string) => void;
  className?: string;
}) {
  const isActive = current === col;
  return (
    <th
      className={cn(
        "py-3 px-3 font-medium cursor-pointer hover:text-foreground select-none",
        className
      )}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          <span className="text-primary text-[10px]">
            {order === "asc" ? "\u25B2" : "\u25BC"}
          </span>
        )}
      </span>
    </th>
  );
}
