"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2, X, ChevronRight, RefreshCw, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { extractItems } from "@/lib/api-client";

type Frequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
type Priority = "P0" | "P1" | "P2" | "P3";
type Category = "PLANNED" | "ADDED" | "INCIDENT" | "SUPPORT" | "ADMIN" | "LEARNING";

type RecurringRule = {
  id: string;
  title: string;
  description?: string | null;
  category?: Category | null;
  priority?: Priority | null;
  frequency: Frequency;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
  timeOfDay?: string | null;
  estimatedHours?: number | null;
  isActive: boolean;
  nextDueAt?: string | null;
  lastGeneratedAt?: string | null;
  assignee?: { id: string; name: string } | null;
  creator: { id: string; name: string };
};

const FREQUENCY_LABEL: Record<Frequency, string> = {
  DAILY: "每日",
  WEEKLY: "每週",
  BIWEEKLY: "雙週",
  MONTHLY: "每月",
  QUARTERLY: "每季",
  YEARLY: "每年",
};

const CATEGORY_LABEL: Record<Category, string> = {
  PLANNED: "計畫性",
  ADDED: "新增需求",
  INCIDENT: "事件",
  SUPPORT: "支援",
  ADMIN: "行政",
  LEARNING: "學習",
};

const PRIORITY_OPTIONS: Priority[] = ["P0", "P1", "P2", "P3"];

const inputCls = "bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors placeholder:text-muted-foreground";
const selectCls = "bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors cursor-pointer";

export function RecurringTaskSection() {
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formFrequency, setFormFrequency] = useState<Frequency>("WEEKLY");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState<Category | "">("");
  const [formPriority, setFormPriority] = useState<Priority | "">("");
  const [formDayOfWeek, setFormDayOfWeek] = useState("");
  const [formDayOfMonth, setFormDayOfMonth] = useState("");
  const [formEstimatedHours, setFormEstimatedHours] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/recurring");
      if (res.ok) {
        const body = await res.json();
        setRules(extractItems<RecurringRule>(body));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  function resetForm() {
    setFormTitle("");
    setFormFrequency("WEEKLY");
    setFormDescription("");
    setFormCategory("");
    setFormPriority("");
    setFormDayOfWeek("");
    setFormDayOfMonth("");
    setFormEstimatedHours("");
  }

  async function createRule() {
    if (!formTitle.trim()) return;
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        title: formTitle.trim(),
        frequency: formFrequency,
      };
      if (formDescription.trim()) body.description = formDescription.trim();
      if (formCategory) body.category = formCategory;
      if (formPriority) body.priority = formPriority;
      if (formDayOfWeek !== "") body.dayOfWeek = Number(formDayOfWeek);
      if (formDayOfMonth !== "") body.dayOfMonth = Number(formDayOfMonth);
      if (formEstimatedHours !== "") body.estimatedHours = Number(formEstimatedHours);

      const res = await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success("週期性規則已建立");
        resetForm();
        setShowForm(false);
        fetchRules();
      } else {
        const errBody = await res.json().catch(() => ({}));
        toast.error(errBody?.message ?? errBody?.error ?? "建立失敗，請再試一次");
      }
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(rule: RecurringRule) {
    setToggling(rule.id);
    try {
      const res = await fetch(`/api/recurring/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      if (res.ok) {
        setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, isActive: !r.isActive } : r));
        toast.success(rule.isActive ? "已停用" : "已啟用");
      } else {
        toast.error("更新失敗");
      }
    } finally {
      setToggling(null);
    }
  }

  async function deleteRule(id: string) {
    if (!confirm("確定要刪除此週期性規則？")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/recurring/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("規則已刪除");
        setRules((prev) => prev.filter((r) => r.id !== id));
      } else {
        toast.error("刪除失敗");
      }
    } finally {
      setDeleting(null);
    }
  }

  async function generateTasks() {
    setGenerating(true);
    try {
      const res = await fetch("/api/recurring/generate", { method: "POST" });
      if (res.ok) {
        toast.success("任務已產生");
        fetchRules();
      } else {
        const errBody = await res.json().catch(() => ({}));
        toast.error(errBody?.message ?? errBody?.error ?? "產生失敗");
      }
    } finally {
      setGenerating(false);
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
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">週期性任務</span>
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <span className="text-xs text-muted-foreground">({rules.length} 個)</span>
          )}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={generateTasks}
            disabled={generating}
            title="產生任務（Manager 限定）"
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-card hover:bg-accent text-foreground rounded-md transition-colors border border-border disabled:opacity-40"
          >
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            產生任務
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-card hover:bg-accent text-foreground rounded-md transition-colors border border-border"
          >
            <Plus className="h-3 w-3" />
            建立規則
          </button>
        </div>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">新增週期性規則</span>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="規則標題（必填）"
              className={cn(inputCls, "flex-1 min-w-48")}
              autoFocus
            />
            <select
              aria-label="頻率"
              value={formFrequency}
              onChange={(e) => setFormFrequency(e.target.value as Frequency)}
              className={cn(selectCls, "w-28")}
            >
              {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => (
                <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>
              ))}
            </select>
          </div>
          <textarea
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="說明（選填）"
            rows={2}
            className={cn(inputCls, "w-full resize-none")}
          />
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="類別（選填）"
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value as Category | "")}
              className={cn(selectCls, "flex-1 min-w-32")}
            >
              <option value="">類別（選填）</option>
              {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </select>
            <select
              aria-label="優先級（選填）"
              value={formPriority}
              onChange={(e) => setFormPriority(e.target.value as Priority | "")}
              className={cn(selectCls, "w-28")}
            >
              <option value="">優先（選填）</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <input
              type="number"
              value={formDayOfWeek}
              onChange={(e) => setFormDayOfWeek(e.target.value)}
              placeholder="星期幾（0-6）"
              min={0}
              max={6}
              className={cn(inputCls, "w-32")}
            />
            <input
              type="number"
              value={formDayOfMonth}
              onChange={(e) => setFormDayOfMonth(e.target.value)}
              placeholder="每月第幾日（1-31）"
              min={1}
              max={31}
              className={cn(inputCls, "w-36")}
            />
            <input
              type="number"
              value={formEstimatedHours}
              onChange={(e) => setFormEstimatedHours(e.target.value)}
              placeholder="預估工時（hr）"
              min={0}
              step={0.5}
              className={cn(inputCls, "w-32")}
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={createRule}
              disabled={creating || !formTitle.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-md disabled:opacity-40 transition-colors"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "建立"}
            </button>
          </div>
        </div>
      )}

      {/* Rules table */}
      {expanded && (
        <div className={cn("px-4 pb-4", !showForm && "border-t border-border pt-3")}>
          {rules.length === 0 && !loading ? (
            <p className="text-xs text-muted-foreground text-center py-4">尚無週期性規則</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">標題</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">頻率</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">下次執行</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">負責人</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground font-medium">狀態</th>
                  <th className="py-1.5 px-2" />
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-b border-border/20 hover:bg-accent/20">
                    <td className="py-1.5 px-2 font-medium text-foreground">{r.title}</td>
                    <td className="py-1.5 px-2 text-muted-foreground">{FREQUENCY_LABEL[r.frequency]}</td>
                    <td className="py-1.5 px-2 text-muted-foreground tabular-nums">
                      {r.nextDueAt ? new Date(r.nextDueAt).toLocaleDateString("zh-TW") : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-muted-foreground">
                      {r.assignee?.name ?? "—"}
                    </td>
                    <td className="py-1.5 px-2">
                      <span className={cn(
                        "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium",
                        r.isActive
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {r.isActive ? "啟用" : "停用"}
                      </span>
                    </td>
                    <td className="py-1.5 px-2">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => toggleActive(r)}
                          disabled={toggling === r.id}
                          title={r.isActive ? "停用" : "啟用"}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
                        >
                          {toggling === r.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <RefreshCw className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => deleteRule(r.id)}
                          disabled={deleting === r.id}
                          title="刪除規則"
                          className="p-1 rounded text-muted-foreground hover:text-rose-400 hover:bg-accent transition-colors disabled:opacity-40"
                        >
                          {deleting === r.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
