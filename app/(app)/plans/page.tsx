"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2, ChevronRight, X, Target, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractItems, extractData } from "@/lib/api-client";
import { PlanTree } from "@/app/components/plan-tree";
import { TaskDetailModal } from "@/app/components/task-detail-modal";
import { PageEmpty } from "@/app/components/page-states";

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
  status: GoalStatus;
  progressPct: number;
  _count?: { tasks: number };
  tasks?: Task[];
};

type AnnualPlan = {
  id: string;
  year: number;
  title: string;
  progressPct: number;
  monthlyGoals: MonthlyGoal[];
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
  const [creatingPlan, setCreatingPlan] = useState(false);

  // Create goal form
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [newGoalPlanId, setNewGoalPlanId] = useState("");
  const [newGoalMonth, setNewGoalMonth] = useState("1");
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [creatingGoal, setCreatingGoal] = useState(false);

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
        setSelectedGoal(extractData<MonthlyGoal>(body));
      }
    } finally {
      setGoalLoading(false);
    }
  }

  async function createPlan() {
    if (!newPlanTitle.trim() || !newPlanYear) return;
    setCreatingPlan(true);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: parseInt(newPlanYear), title: newPlanTitle.trim() }),
      });
      if (res.ok) {
        setNewPlanTitle("");
        setShowPlanForm(false);
        fetchPlans();
      } else {
        const errBody = await res.json().catch(() => ({}));
        alert(errBody?.message ?? errBody?.error ?? "建立失敗");
      }
    } finally {
      setCreatingPlan(false);
    }
  }

  async function createGoal() {
    if (!newGoalTitle.trim() || !newGoalPlanId) return;
    setCreatingGoal(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annualPlanId: newGoalPlanId, month: parseInt(newGoalMonth), title: newGoalTitle.trim() }),
      });
      if (res.ok) {
        setNewGoalTitle("");
        setShowGoalForm(false);
        fetchPlans();
      } else {
        const errBody = await res.json().catch(() => ({}));
        alert(errBody?.message ?? errBody?.error ?? "月度目標建立失敗");
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
        setCopyError(errBody?.error ?? "複製失敗，請再試一次");
      }
    } finally {
      setCopyingTemplate(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">年度計畫</h1>
          <p className="text-muted-foreground text-sm mt-0.5">管理年度計畫與月度目標</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGoalForm(true)}
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
            onClick={() => setShowPlanForm(true)}
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
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">新增年度計畫</h3>
            <button onClick={() => setShowPlanForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-3">
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
        </div>
      )}

      {/* Copy template form */}
      {showCopyForm && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">從上年複製計畫</h3>
            <button onClick={() => setShowCopyForm(false)} className="text-muted-foreground hover:text-foreground">
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
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">新增月度目標</h3>
            <button onClick={() => setShowGoalForm(false)} className="text-muted-foreground hover:text-foreground">
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
          title="尚無年度計畫"
          description="目前沒有任何計畫，請點擊「新增年度計畫」建立"
        />
      ) : (

        <PlanTree
          plans={plans}
          onSelectGoal={(goalId) => loadGoal(goalId)}
          onSelectPlan={() => {}}
        />
      )}

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
              {goalLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <button
                onClick={() => setSelectedGoal(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
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
