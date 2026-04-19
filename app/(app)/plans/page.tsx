"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2, ChevronRight, X, Target, Copy, Archive, ArchiveRestore } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractItems, extractData } from "@/lib/api-client";
import { PlanTree } from "@/app/components/plan-tree";
import { TaskDetailModal } from "@/app/components/task-detail-modal";
import { PageEmpty } from "@/app/components/page-states";
import { MilestoneSection } from "@/app/components/milestone-section";
import { RetrospectiveGenerator } from "@/app/components/retrospective-generator";

type GoalStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  category: string;
  dueDate?: string | null;
  primaryAssignee?: { id: string; name: string; avatar?: string | null } | null;
};

type MonthlyGoal = {
  id: string;
  month: number;
  title: string;
  retrospectiveNote?: string | null;
  status: GoalStatus;
  progressPct: number;
  _count?: { tasks: number };
  tasks?: Task[];
};

type AnnualPlan = {
  id: string;
  year: number;
  title: string;
  vision?: string | null;
  description?: string | null;
  progressPct: number;
  archivedAt?: string | null;
  monthlyGoals: MonthlyGoal[];
};

const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  NOT_STARTED: "未開始", IN_PROGRESS: "進行中", COMPLETED: "已完成", CANCELLED: "已取消",
};

const GOAL_STATUS_COLOR: Record<GoalStatus, string> = {
  NOT_STARTED: "text-muted-foreground",
  IN_PROGRESS: "text-yellow-400",
  COMPLETED: "text-emerald-400",
  CANCELLED: "text-rose-400",
};

const GOAL_TRANSITIONS: Record<GoalStatus, GoalStatus[]> = {
  NOT_STARTED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const statusLabels: Record<TaskStatus, string> = {
  BACKLOG: "待辦清單",
  TODO: "待處理",
  IN_PROGRESS: "進行中",
  REVIEW: "審核中",
  DONE: "已完成",
};

const statusColors: Record<TaskStatus, string> = {
  BACKLOG: "text-muted-foreground",
  TODO: "text-blue-400",
  IN_PROGRESS: "text-yellow-400",
  REVIEW: "text-purple-400",
  DONE: "text-emerald-400",
};

const monthNames = ["", "1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

// ─── Linked Projects ─────────────────────────────────────────────────────────

const PROJECT_STATUS_LABEL: Record<string, string> = {
  PROPOSED: "提案", EVALUATING: "評估中", APPROVED: "已核准", SCHEDULED: "已排程",
  REQUIREMENTS: "需求分析", DESIGN: "系統設計", DEVELOPMENT: "開發中", TESTING: "測試中",
  DEPLOYMENT: "部署中", WARRANTY: "保固期", COMPLETED: "已完成", POST_REVIEW: "後評價",
  CLOSED: "已關閉", ON_HOLD: "暫停", CANCELLED: "已取消",
};

const PROJECT_STATUS_COLOR: Record<string, string> = {
  COMPLETED: "text-emerald-400", CLOSED: "text-muted-foreground", CANCELLED: "text-muted-foreground/50",
  DEVELOPMENT: "text-amber-400", TESTING: "text-orange-400", DEPLOYMENT: "text-rose-400",
};

type LinkedProject = {
  id: string;
  code: string;
  name: string;
  status: string;
  progressPct: number;
};

function LinkedProjects({ planYear, planTitle }: { planYear: number; planTitle: string }) {
  const [projects, setProjects] = useState<LinkedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/projects?year=${planYear}&limit=50`)
      .then(r => r.json())
      .then(d => {
        const items = d?.data?.items ?? d?.items ?? [];
        setProjects(items.map((p: Record<string, unknown>) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          status: p.status,
          progressPct: p.progressPct ?? 0,
        })));
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, [planYear]);

  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (projects.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", expanded && "rotate-90")} />
          <span className="text-sm font-medium">關聯項目</span>
          <span className="text-xs text-muted-foreground">({planTitle} — {projects.length} 個項目)</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">編號</th>
                <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">名稱</th>
                <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">狀態</th>
                <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">進度</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-border/20 hover:bg-accent/20">
                  <td className="py-1.5 px-2 font-mono">{p.code}</td>
                  <td className="py-1.5 px-2">{p.name}</td>
                  <td className={cn("py-1.5 px-2", PROJECT_STATUS_COLOR[p.status] ?? "text-blue-400")}>
                    {PROJECT_STATUS_LABEL[p.status] ?? p.status}
                  </td>
                  <td className="text-right py-1.5 px-2 tabular-nums">{p.progressPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PlansPage() {
  const [plans, setPlans] = useState<AnnualPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoal, setSelectedGoal] = useState<MonthlyGoal | null>(null);
  const [goalLoading, setGoalLoading] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Create plan form
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [newPlanYear, setNewPlanYear] = useState(new Date().getFullYear().toString());
  const [newPlanTitle, setNewPlanTitle] = useState("");
  const [newPlanVision, setNewPlanVision] = useState("");
  const [newPlanDescription, setNewPlanDescription] = useState("");
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [planError, setPlanError] = useState("");
  const [archiving, setArchiving] = useState<string | null>(null);

  // Retrospective note
  const [retroNote, setRetroNote] = useState("");
  const [savingRetro, setSavingRetro] = useState(false);

  // Create goal form
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [newGoalPlanId, setNewGoalPlanId] = useState("");
  const [newGoalMonth, setNewGoalMonth] = useState("1");
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [creatingGoal, setCreatingGoal] = useState(false);
  const [goalError, setGoalError] = useState("");

  // Copy template form
  const [showCopyForm, setShowCopyForm] = useState(false);
  const [copySourcePlanId, setCopySourcePlanId] = useState("");
  const [copyTargetYear, setCopyTargetYear] = useState((new Date().getFullYear() + 1).toString());
  const [copyingTemplate, setCopyingTemplate] = useState(false);
  const [copyError, setCopyError] = useState("");

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/plans");
      if (res.ok) {
        const body = await res.json();
        setPlans(extractItems<AnnualPlan>(body));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  async function loadGoal(goalId: string) {
    setGoalLoading(true);
    try {
      const res = await fetch(`/api/goals/${goalId}`);
      if (res.ok) {
        const body = await res.json();
        const goal = extractData<MonthlyGoal>(body);
        setSelectedGoal(goal);
        setRetroNote(goal.retrospectiveNote ?? "");
      }
    } finally {
      setGoalLoading(false);
    }
  }

  async function saveRetrospectiveNote() {
    if (!selectedGoal) return;
    setSavingRetro(true);
    try {
      const res = await fetch(`/api/goals/${selectedGoal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retrospectiveNote: retroNote || null }),
      });
      if (res.ok) {
        const body = await res.json();
        const updated = extractData<MonthlyGoal>(body);
        setSelectedGoal((prev) => prev ? { ...prev, retrospectiveNote: updated.retrospectiveNote } : prev);
      }
    } finally {
      setSavingRetro(false);
    }
  }

  const [updatingGoalStatus, setUpdatingGoalStatus] = useState(false);

  async function updateGoalStatus(status: GoalStatus) {
    if (!selectedGoal) return;
    setUpdatingGoalStatus(true);
    try {
      const res = await fetch(`/api/goals/${selectedGoal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setSelectedGoal((prev) => prev ? { ...prev, status } : prev);
        fetchPlans();
      }
    } finally {
      setUpdatingGoalStatus(false);
    }
  }

  async function createPlan() {
    if (!newPlanTitle.trim() || !newPlanYear) return;
    setCreatingPlan(true);
    setPlanError("");
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: parseInt(newPlanYear), title: newPlanTitle.trim(), vision: newPlanVision.trim() || undefined, description: newPlanDescription.trim() || undefined }),
      });
      if (res.ok) {
        setNewPlanTitle("");
        setNewPlanVision("");
        setNewPlanDescription("");
        setShowPlanForm(false);
        setPlanError("");
        fetchPlans();
      } else {
        const errBody = await res.json().catch(() => ({}));
        setPlanError(errBody?.message ?? errBody?.error ?? "建立失敗，請再試一次");
      }
    } finally {
      setCreatingPlan(false);
    }
  }

  async function createGoal() {
    if (!newGoalTitle.trim() || !newGoalPlanId) return;
    setCreatingGoal(true);
    setGoalError("");
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annualPlanId: newGoalPlanId, month: parseInt(newGoalMonth), title: newGoalTitle.trim() }),
      });
      if (res.ok) {
        setNewGoalTitle("");
        setShowGoalForm(false);
        setGoalError("");
        fetchPlans();
      } else {
        const errBody = await res.json().catch(() => ({}));
        setGoalError(errBody?.message ?? errBody?.error ?? "月度目標建立失敗，請再試一次");
      }
    } finally {
      setCreatingGoal(false);
    }
  }

  async function copyTemplate() {
    if (!copySourcePlanId || !copyTargetYear) return;
    setCopyingTemplate(true);
    setCopyError("");
    try {
      const res = await fetch("/api/plans/copy-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePlanId: copySourcePlanId, targetYear: parseInt(copyTargetYear) }),
      });
      if (res.ok) {
        setCopySourcePlanId("");
        setShowCopyForm(false);
        fetchPlans();
      } else {
        const errBody = await res.json().catch(() => ({}));
        setCopyError(errBody?.message ?? errBody?.error ?? "複製失敗，請再試一次");
      }
    } finally {
      setCopyingTemplate(false);
    }
  }

  async function toggleArchive(planId: string, isArchived: boolean) {
    setArchiving(planId);
    try {
      const res = await fetch(`/api/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !isArchived }),
      });
      if (res.ok) {
        fetchPlans();
      }
    } finally {
      setArchiving(null);
    }
  }

  const inputCls = "bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors placeholder:text-muted-foreground";
  const selectCls = "bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors cursor-pointer";

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="text-foreground font-medium">年度計畫</span>
        {selectedGoal && (
          <>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">
              {monthNames[selectedGoal.month]} — {selectedGoal.title}
            </span>
          </>
        )}
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">年度計畫</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">管理年度計畫與月度目標</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setShowGoalForm(true); setGoalError(""); }}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-card hover:bg-accent text-foreground rounded-md transition-colors border border-border"
          >
            <Plus className="h-3.5 w-3.5" />
            新增月度目標
          </button>
          <button
            onClick={() => { setShowCopyForm((v) => !v); setShowPlanForm(false); setCopyError(""); }}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-card hover:bg-accent text-foreground rounded-md transition-colors border border-border"
          >
            <Copy className="h-3.5 w-3.5" />
            從上年複製
          </button>
          <button
            onClick={() => { setShowPlanForm(true); setPlanError(""); }}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md transition-colors"
          >
            <Target className="h-3.5 w-3.5" />
            新增年度計畫
          </button>
        </div>
      </div>

      {/* Create plan form */}
      {showPlanForm && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-foreground">新增年度計畫</h3>
            <button onClick={() => setShowPlanForm(false)} className="text-muted-foreground hover:text-foreground" aria-label="關閉">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              type="number"
              value={newPlanYear}
              onChange={(e) => setNewPlanYear(e.target.value)}
              placeholder="年份"
              className={cn(inputCls, "w-24")}
            />
            <input
              type="text"
              value={newPlanTitle}
              onChange={(e) => setNewPlanTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createPlan()}
              placeholder="計畫標題"
              className={cn(inputCls, "flex-1")}
              autoFocus
            />
            <button
              onClick={createPlan}
              disabled={creatingPlan || !newPlanTitle.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-md disabled:opacity-40 transition-colors"
            >
              {creatingPlan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "建立"}
            </button>
          </div>
          <textarea
            value={newPlanVision}
            onChange={(e) => setNewPlanVision(e.target.value)}
            placeholder="年度願景/使命描述（選填）"
            rows={2}
            className={cn(inputCls, "w-full resize-none")}
          />
          <input
            type="text"
            value={newPlanDescription}
            onChange={(e) => setNewPlanDescription(e.target.value)}
            placeholder="計畫描述（選填）"
            className={cn(inputCls, "w-full")}
          />
          {planError && (
            <p className="text-xs text-danger">{planError}</p>
          )}
        </div>
      )}

      {/* Copy template form */}
      {showCopyForm && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-foreground">從上年複製計畫</h3>
            <button onClick={() => setShowCopyForm(false)} className="text-muted-foreground hover:text-foreground" aria-label="關閉">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">選擇來源計畫，系統將複製其架構（月度目標與里程碑）到新年度。</p>
          <div className="flex gap-3 flex-wrap">
            <select
              aria-label="來源計畫"
              value={copySourcePlanId}
              onChange={(e) => setCopySourcePlanId(e.target.value)}
              className={cn(selectCls, "flex-1 min-w-48")}
            >
              <option value="">選擇來源計畫</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.year} — {p.title}</option>
              ))}
            </select>
            <input
              type="number"
              value={copyTargetYear}
              onChange={(e) => setCopyTargetYear(e.target.value)}
              placeholder="目標年份"
              className={cn(inputCls, "w-28")}
            />
            <button
              onClick={copyTemplate}
              disabled={copyingTemplate || !copySourcePlanId || !copyTargetYear}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-md disabled:opacity-40 transition-colors"
            >
              {copyingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Copy className="h-3.5 w-3.5" />複製</>}
            </button>
          </div>
          {copyError && (
            <p className="text-xs text-danger">{copyError}</p>
          )}
        </div>
      )}

      {/* Create goal form */}
      {showGoalForm && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-foreground">新增月度目標</h3>
            <button onClick={() => setShowGoalForm(false)} className="text-muted-foreground hover:text-foreground" aria-label="關閉">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-3 flex-wrap">
            <select
              aria-label="年度計畫"
              value={newGoalPlanId}
              onChange={(e) => setNewGoalPlanId(e.target.value)}
              className={cn(selectCls, "flex-1 min-w-40")}
            >
              <option value="">選擇年度計畫</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.year} — {p.title}</option>
              ))}
            </select>
            <select
              aria-label="目標月份"
              value={newGoalMonth}
              onChange={(e) => setNewGoalMonth(e.target.value)}
              className={cn(selectCls, "w-24")}
            >
              {monthNames.slice(1).map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
            <input
              type="text"
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createGoal()}
              placeholder="目標標題"
              className={cn(inputCls, "flex-1 min-w-48")}
              autoFocus
            />
            <button
              onClick={createGoal}
              disabled={creatingGoal || !newGoalTitle.trim() || !newGoalPlanId}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-md disabled:opacity-40 transition-colors"
            >
              {creatingGoal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "建立"}
            </button>
          </div>
          {goalError && (
            <p className="text-xs text-danger">{goalError}</p>
          )}
        </div>
      )}

      {/* Plan tree */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : plans.length === 0 ? (
        <PageEmpty
          icon={<Target className="h-10 w-10" />}
          title="建立第一個年度計畫，把目標落實到月度行動"
          description="設定年度願景與月度里程碑，追蹤全年進度"
          action={
            <button
              onClick={() => { setShowPlanForm(true); setPlanError(""); }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all"
            >
              <Target className="h-3.5 w-3.5" />
              建立計畫
            </button>
          }
        />
      ) : (

        <PlanTree
          plans={plans}
          onSelectGoal={(goalId) => loadGoal(goalId)}
          onSelectPlan={() => {}}
          onToggleArchive={toggleArchive}
          archivingId={archiving}
        />
      )}

      {/* Linked projects */}
      {!loading && plans.filter(p => !p.archivedAt).map((plan) => (
        <LinkedProjects key={plan.id} planYear={plan.year} planTitle={plan.title} />
      ))}

      {/* Milestones */}
      {!loading && plans.filter(p => !p.archivedAt).length > 0 && (
        <MilestoneSection plans={plans.filter(p => !p.archivedAt).map(p => ({ id: p.id, year: p.year, title: p.title }))} />
      )}

      {/* Retrospective Generator */}
      {!loading && plans.length > 0 && <RetrospectiveGenerator />}

      {/* Goal detail panel */}
      {selectedGoal && (
        <div className="bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">月度目標詳情</div>
              <h2 className="text-sm font-medium text-foreground">
                {monthNames[selectedGoal.month]} — {selectedGoal.title}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {(goalLoading || updatingGoalStatus) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {/* Goal status dropdown */}
              {GOAL_TRANSITIONS[selectedGoal.status].length > 0 ? (
                <select
                  aria-label="目標狀態"
                  value={selectedGoal.status}
                  onChange={(e) => updateGoalStatus(e.target.value as GoalStatus)}
                  disabled={updatingGoalStatus}
                  className={cn(
                    selectCls, "text-xs py-1 px-2 disabled:opacity-50",
                    GOAL_STATUS_COLOR[selectedGoal.status]
                  )}
                >
                  <option value={selectedGoal.status}>{GOAL_STATUS_LABEL[selectedGoal.status]}</option>
                  {GOAL_TRANSITIONS[selectedGoal.status].map((s) => (
                    <option key={s} value={s}>{GOAL_STATUS_LABEL[s]}</option>
                  ))}
                </select>
              ) : (
                <span className={cn("text-xs font-medium px-2 py-1", GOAL_STATUS_COLOR[selectedGoal.status])}>
                  {GOAL_STATUS_LABEL[selectedGoal.status]}
                </span>
              )}
              <button
                onClick={() => setSelectedGoal(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="關閉目標詳情"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tasks in this goal */}
          <div className="p-4">
            {selectedGoal.tasks && selectedGoal.tasks.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground mb-3">個人任務</h3>
                {selectedGoal.tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors group"
                  >
                    <span className={cn("text-xs font-medium w-16 flex-shrink-0", statusColors[task.status])}>
                      {statusLabels[task.status]}
                    </span>
                    <span className="flex-1 text-sm text-foreground group-hover:text-foreground/90 truncate transition-colors">
                      {task.title}
                    </span>
                    {task.primaryAssignee && (
                      <div className="flex-shrink-0 h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                        {task.primaryAssignee.name.charAt(0)}
                      </div>
                    )}
                    {task.dueDate && (
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {new Date(task.dueDate).getMonth() + 1}/{new Date(task.dueDate).getDate()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">此月度目標尚無任務</p>
            )}

            {/* Retrospective note */}
            <div className="mt-4 pt-4 border-t border-border">
              <h3 className="text-xs font-medium text-muted-foreground mb-2">月底復盤筆記</h3>
              <textarea
                value={retroNote}
                onChange={(e) => setRetroNote(e.target.value)}
                placeholder="記錄本月回顧與反思..."
                rows={3}
                className={cn(inputCls, "w-full resize-none")}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={saveRetrospectiveNote}
                  disabled={savingRetro || retroNote === (selectedGoal.retrospectiveNote ?? "")}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-accent hover:bg-accent/80 text-accent-foreground rounded-md disabled:opacity-40 transition-colors"
                >
                  {savingRetro ? <Loader2 className="h-3 w-3 animate-spin" /> : "儲存筆記"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task detail modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdated={() => {
            setSelectedTaskId(null);
            if (selectedGoal) loadGoal(selectedGoal.id);
          }}
        />
      )}
    </div>
  );
}
