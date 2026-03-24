"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Save, Loader2, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SubTaskList } from "./subtask-list";
import { DeliverableList } from "./deliverable-list";

type User = { id: string; name: string; avatar?: string | null };
type MonthlyGoal = { id: string; title: string; month: number };

type TaskDetail = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  category: string;
  primaryAssigneeId?: string | null;
  backupAssigneeId?: string | null;
  monthlyGoalId?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  subTasks: { id: string; title: string; done: boolean; order: number }[];
  deliverables: {
    id: string;
    title: string;
    type: "DOCUMENT" | "SYSTEM" | "REPORT" | "APPROVAL";
    status: "NOT_STARTED" | "IN_PROGRESS" | "DELIVERED" | "ACCEPTED";
    attachmentUrl?: string | null;
  }[];
  primaryAssignee?: User | null;
  backupAssignee?: User | null;
  monthlyGoal?: MonthlyGoal | null;
};

interface TaskDetailModalProps {
  taskId: string;
  onClose: () => void;
  onUpdated?: () => void;
}

type TaskForm = {
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  primaryAssigneeId: string;
  backupAssigneeId: string;
  monthlyGoalId: string;
  dueDate: string;
  estimatedHours: string;
};

const initialForm: TaskForm = {
  title: "",
  description: "",
  status: "",
  priority: "",
  category: "",
  primaryAssigneeId: "",
  backupAssigneeId: "",
  monthlyGoalId: "",
  dueDate: "",
  estimatedHours: "",
};

const statusOptions = [
  { value: "BACKLOG", label: "待辦清單" },
  { value: "TODO", label: "待處理" },
  { value: "IN_PROGRESS", label: "進行中" },
  { value: "REVIEW", label: "審核中" },
  { value: "DONE", label: "已完成" },
];

const priorityOptions = [
  { value: "P0", label: "P0 緊急" },
  { value: "P1", label: "P1 高" },
  { value: "P2", label: "P2 中" },
  { value: "P3", label: "P3 低" },
];

const categoryOptions = [
  { value: "PLANNED", label: "原始規劃" },
  { value: "ADDED", label: "追加任務" },
  { value: "INCIDENT", label: "突發事件" },
  { value: "SUPPORT", label: "用戶支援" },
  { value: "ADMIN", label: "行政庶務" },
  { value: "LEARNING", label: "學習成長" },
];

const inputCls =
  "w-full h-10 bg-background border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/60";

const selectCls =
  "w-full h-10 bg-background border border-border rounded-lg px-3 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-muted-foreground mb-1.5">{children}</label>;
}

export function TaskDetailModal({ taskId, onClose, onUpdated }: TaskDetailModalProps) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);

  // Consolidated form state
  const [form, setForm] = useState<TaskForm>(initialForm);

  const updateField = useCallback(
    <K extends keyof TaskForm>(field: K, value: TaskForm[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const loadTask = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.ok) {
        const data: TaskDetail = await res.json();
        setTask(data);
        setForm({
          title: data.title,
          description: data.description ?? "",
          status: data.status,
          priority: data.priority,
          category: data.category,
          primaryAssigneeId: data.primaryAssigneeId ?? "",
          backupAssigneeId: data.backupAssigneeId ?? "",
          monthlyGoalId: data.monthlyGoalId ?? "",
          dueDate: data.dueDate ? data.dueDate.split("T")[0] : "",
          estimatedHours: data.estimatedHours?.toString() ?? "",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadTask();
    fetch("/api/users").then((r) => r.json()).then((d) => setUsers(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/goals").then((r) => r.json()).then((d) => setGoals(Array.isArray(d) ? d : [])).catch(() => {});
  }, [loadTask]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          status: form.status,
          priority: form.priority,
          category: form.category,
          primaryAssigneeId: form.primaryAssigneeId || null,
          backupAssigneeId: form.backupAssigneeId || null,
          monthlyGoalId: form.monthlyGoalId || null,
          dueDate: form.dueDate || null,
          estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : null,
        }),
      });
      if (res.ok) {
        onUpdated?.();
      }
    } finally {
      setSaving(false);
    }
  }

  // Close on backdrop click or Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm pt-12 pb-4 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10 rounded-t-2xl">
          <h2 className="text-sm font-medium text-foreground tracking-wide">任務詳情</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving || loading}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium h-8 px-3 rounded-lg transition-all",
                "bg-primary text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-40"
              )}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              儲存
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : task ? (
          <div className="p-5 space-y-5">
            {/* Title */}
            <div>
              <Label>標題</Label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Description */}
            <div>
              <Label>描述</Label>
              <textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={3}
                placeholder="任務描述..."
                className={cn(inputCls, "resize-none")}
              />
            </div>

            {/* Status / Priority / Category */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>狀態</Label>
                <select value={form.status} onChange={(e) => updateField("status", e.target.value)} className={selectCls}>
                  {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <Label>優先度</Label>
                <select value={form.priority} onChange={(e) => updateField("priority", e.target.value)} className={selectCls}>
                  {priorityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <Label>分類</Label>
                <select value={form.category} onChange={(e) => updateField("category", e.target.value)} className={selectCls}>
                  {categoryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* A角 / B角 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>A角（主要負責人）</Label>
                <select value={form.primaryAssigneeId} onChange={(e) => updateField("primaryAssigneeId", e.target.value)} className={selectCls}>
                  <option value="">未指派</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <Label>B角（備援負責人）</Label>
                <select value={form.backupAssigneeId} onChange={(e) => updateField("backupAssigneeId", e.target.value)} className={selectCls}>
                  <option value="">未指派</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>

            {/* Due date / Estimated hours */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>截止日期</Label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => updateField("dueDate", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <Label>預估工時（小時）</Label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.estimatedHours}
                  onChange={(e) => updateField("estimatedHours", e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Monthly Goal link */}
            <div>
              <Label>
                <span className="flex items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  連結月度目標
                </span>
              </Label>
              <select value={form.monthlyGoalId} onChange={(e) => updateField("monthlyGoalId", e.target.value)} className={selectCls}>
                <option value="">不連結</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>{g.month}月 — {g.title}</option>
                ))}
              </select>
            </div>

            {/* Subtasks */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2">子任務清單</h3>
              <div className="bg-muted/30 rounded-xl p-3">
                <SubTaskList
                  subtasks={task.subTasks}
                  taskId={taskId}
                />
              </div>
            </div>

            {/* Deliverables */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2">交付項</h3>
              <div className="bg-muted/30 rounded-xl p-3">
                <DeliverableList
                  deliverables={task.deliverables}
                  taskId={taskId}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="py-16 text-center text-muted-foreground text-sm">任務不存在</div>
        )}
      </div>
    </div>
  );
}
