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
  "w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-colors placeholder:text-muted-foreground";

const selectCls =
  "w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-colors cursor-pointer";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-muted-foreground mb-1">{children}</label>;
}

export function TaskDetailModal({ taskId, onClose, onUpdated }: TaskDetailModalProps) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);

  // Editable fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [primaryAssigneeId, setPrimaryAssigneeId] = useState("");
  const [backupAssigneeId, setBackupAssigneeId] = useState("");
  const [monthlyGoalId, setMonthlyGoalId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");

  const loadTask = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.ok) {
        const data: TaskDetail = await res.json();
        setTask(data);
        setTitle(data.title);
        setDescription(data.description ?? "");
        setStatus(data.status);
        setPriority(data.priority);
        setCategory(data.category);
        setPrimaryAssigneeId(data.primaryAssigneeId ?? "");
        setBackupAssigneeId(data.backupAssigneeId ?? "");
        setMonthlyGoalId(data.monthlyGoalId ?? "");
        setDueDate(data.dueDate ? data.dueDate.split("T")[0] : "");
        setEstimatedHours(data.estimatedHours?.toString() ?? "");
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
          title,
          description: description || null,
          status,
          priority,
          category,
          primaryAssigneeId: primaryAssigneeId || null,
          backupAssigneeId: backupAssigneeId || null,
          monthlyGoalId: monthlyGoalId || null,
          dueDate: dueDate || null,
          estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
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
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-sm font-medium text-foreground tracking-wide">任務詳情</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving || loading}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors",
                "bg-accent hover:bg-accent/80 text-accent-foreground disabled:opacity-40"
              )}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              儲存
            </button>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
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
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Description */}
            <div>
              <Label>描述</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="任務描述..."
                className={cn(inputCls, "resize-none")}
              />
            </div>

            {/* Status / Priority / Category */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>狀態</Label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
                  {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <Label>優先度</Label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className={selectCls}>
                  {priorityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <Label>分類</Label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
                  {categoryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* A角 / B角 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>A角（主要負責人）</Label>
                <select value={primaryAssigneeId} onChange={(e) => setPrimaryAssigneeId(e.target.value)} className={selectCls}>
                  <option value="">未指派</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <Label>B角（備援負責人）</Label>
                <select value={backupAssigneeId} onChange={(e) => setBackupAssigneeId(e.target.value)} className={selectCls}>
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
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <Label>預估工時（小時）</Label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
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
              <select value={monthlyGoalId} onChange={(e) => setMonthlyGoalId(e.target.value)} className={selectCls}>
                <option value="">不連結</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>{g.month}月 — {g.title}</option>
                ))}
              </select>
            </div>

            {/* Subtasks */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2">子任務清單</h3>
              <div className="bg-muted/30 border border-border rounded-lg p-3">
                <SubTaskList
                  subtasks={task.subTasks}
                  taskId={taskId}
                />
              </div>
            </div>

            {/* Deliverables */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2">交付項</h3>
              <div className="bg-muted/30 border border-border rounded-lg p-3">
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
