"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData, extractItems } from "@/lib/api-client";
import { TaskFormFields, TaskSubtaskSection, TaskDeliverableSection, initialForm } from "./task-detail/index";
import type { TaskForm } from "./task-detail/index";

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

export function TaskDetailModal({ taskId, onClose, onUpdated }: TaskDetailModalProps) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
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
        const body = await res.json();
        const data = extractData<TaskDetail>(body);
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
    fetch("/api/users").then((r) => r.json()).then((body) => setUsers(extractItems<User>(body))).catch(() => {});
    fetch("/api/goals").then((r) => r.json()).then((body) => setGoals(extractItems<MonthlyGoal>(body))).catch(() => {});
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
          dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
          estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : null,
        }),
      });
      if (res.ok) {
        onUpdated?.();
      } else {
        const errBody = await res.json().catch(() => ({}));
        const msg = errBody?.message ?? errBody?.error ?? "儲存失敗";
        alert(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  // Close on Escape
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
            <TaskFormFields
              form={form}
              onFieldChange={updateField}
              users={users}
              goals={goals}
            />

            <TaskSubtaskSection
              subtasks={task.subTasks}
              taskId={taskId}
            />

            <TaskDeliverableSection
              deliverables={task.deliverables}
              taskId={taskId}
            />
          </div>
        ) : (
          <div className="py-16 text-center text-muted-foreground text-sm">任務不存在</div>
        )}
      </div>
    </div>
  );
}
