"use client";

/**
 * TaskDetailModal — Enhanced for Issue #805 (K-3a)
 *
 * Adds:
 * - Markdown description editor with edit/preview tabs
 * - Comment list with @mention, edit (5 min), delete
 * - Tabs: 詳情 | 評論
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Save, Loader2, History, MessageSquare, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { extractData, extractItems } from "@/lib/api-client";
import { TaskFormFields, TaskSubtaskSection, TaskAttachmentSection, TaskDeliverableSection, TaskIncidentSection, TaskDocumentSection, TaskChangeManagementSection, initialForm } from "./task-detail/index";
import type { TaskForm, FormErrors } from "./task-detail/index";
import { TaskChangeHistory } from "./task-change-history";
import { MarkdownEditor } from "./markdown-editor";
import { CommentList } from "./comment-list";

type User = { id: string; name: string; avatar?: string | null };
type MonthlyGoal = { id: string; title: string; month: number };
type ProjectOption = { id: string; code: string; name: string };

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
  projectId?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  tags?: string[];
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
  _count?: { comments?: number };
};

interface TaskDetailModalProps {
  taskId: string;
  onClose: () => void;
  onUpdated?: () => void;
}

type ModalTab = "detail" | "history" | "comments";

export function TaskDetailModal({ taskId, onClose, onUpdated }: TaskDetailModalProps) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [form, setForm] = useState<TaskForm>(initialForm);
  const [activeTab, setActiveTab] = useState<ModalTab>("detail");
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Restore focus to the triggering element when the modal closes (a11y fix #1341)
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

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
          projectId: data.projectId ?? "",
          dueDate: data.dueDate ? data.dueDate.split("T")[0] : "",
          estimatedHours: data.estimatedHours?.toString() ?? "",
          tags: data.tags ?? [],
        });
      }
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadTask();
    fetch("/api/users").then((r) => r.json()).then((body) => setUsers(extractItems<User>(body))).catch(() => { toast.error("使用者清單載入失敗"); });
    fetch("/api/goals").then((r) => r.json()).then((body) => setGoals(extractItems<MonthlyGoal>(body))).catch(() => { toast.error("目標清單載入失敗"); });
    // Fetch projects for linking (Issue #1176)
    fetch("/api/projects?limit=100").then((r) => r.json()).then((body) => {
      const data = body?.data ?? body;
      const items = (data?.items ?? []) as ProjectOption[];
      setProjects(items.map((p) => ({ id: p.id, code: p.code, name: p.name })));
    }).catch(() => { toast.error("專案清單載入失敗"); });
    // Get current user for comment ownership
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => setCurrentUserId(s?.user?.id))
      .catch(() => { toast.warning("使用者資訊載入失敗"); });
  }, [loadTask]);

  /** Client-side validation — Issue #804 (K-2) */
  function validateForm(): FormErrors {
    const errors: FormErrors = {};
    if (!form.title.trim()) errors.title = "標題為必填";
    else if (form.title.length > 200) errors.title = "標題不得超過 200 字元";
    if (!form.primaryAssigneeId) errors.primaryAssigneeId = "指派人為必填";
    if (!form.dueDate) errors.dueDate = "到期日為必填";
    if (form.tags.length === 0) errors.tags = "至少需要一個標籤";
    return errors;
  }

  async function save() {
    // Validate before save
    const errors = validateForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

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
          projectId: form.projectId || null,
          dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
          estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : null,
          tags: form.tags,
        }),
      });
      if (res.ok) {
        toast.success("任務已儲存");
        onUpdated?.();
      } else {
        const errBody = await res.json().catch(() => ({}));
        const msg = errBody?.message ?? errBody?.error ?? "儲存失敗";
        toast.error("儲存失敗", { description: msg });
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask() {
    if (!window.confirm("確定要刪除此任務嗎？此操作無法復原。")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("任務已刪除");
        onUpdated?.();
      } else {
        const errBody = await res.json().catch(() => ({}));
        toast.error(errBody?.message ?? errBody?.error ?? "刪除失敗");
      }
    } finally {
      setDeleting(false);
    }
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const commentCount = task?._count?.comments ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm pt-12 pb-4 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10 rounded-t-2xl">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-medium text-foreground tracking-wide">任務詳情</h2>
            {/* Tabs — Issue #805, #806 */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("detail")}
                className={cn(
                  "flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors",
                  activeTab === "detail"
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <FileText className="h-3 w-3" />
                詳情
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={cn(
                  "flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors",
                  activeTab === "history"
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <History className="h-3 w-3" />
                變更歷史
              </button>
              <button
                onClick={() => setActiveTab("comments")}
                className={cn(
                  "flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors",
                  activeTab === "comments"
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <MessageSquare className="h-3 w-3" />
                評論
                {commentCount > 0 && (
                  <span className="text-[10px] bg-muted px-1 rounded tabular-nums">
                    {commentCount}
                  </span>
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={deleteTask}
              disabled={deleting || loading}
              data-testid="delete-task-btn"
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium h-8 px-3 rounded-lg transition-all",
                "bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-40"
              )}
            >
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              刪除
            </button>
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
              aria-label="關閉任務詳情"
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
            {activeTab === "detail" ? (
              <>
                <TaskFormFields
                  form={form}
                  onFieldChange={updateField}
                  users={users}
                  goals={goals}
                  projects={projects}
                  errors={formErrors}
                />

                {/* Markdown Description — Issue #805 (K-3a) */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    描述 (Markdown)
                  </label>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <MarkdownEditor
                      value={form.description}
                      onChange={(v) => updateField("description", v)}
                      placeholder="輸入任務描述（支援 Markdown）..."
                      minHeight={200}
                      maxLength={10000}
                    />
                  </div>
                </div>

                <TaskIncidentSection
                  taskId={taskId}
                  category={form.category}
                />

                <TaskChangeManagementSection
                  taskId={taskId}
                />

                <TaskSubtaskSection
                  subtasks={task.subTasks}
                  taskId={taskId}
                />

                <TaskAttachmentSection
                  taskId={taskId}
                  attachments={(task as unknown as { attachments?: { id: string; fileName: string; fileSize: number; mimeType: string; storagePath: string; uploaderId: string; createdAt: string; uploader?: { id: string; name: string } | null }[] }).attachments ?? []}
                />

                <TaskDocumentSection
                  taskId={taskId}
                />

                <TaskDeliverableSection
                  deliverables={task.deliverables}
                  taskId={taskId}
                />
              </>
            ) : activeTab === "history" ? (
              /* Change History tab — Issue #806 (K-6) */
              <TaskChangeHistory taskId={taskId} />
            ) : (
              /* Comments tab — Issue #805 (K-3a) */
              <CommentList
                taskId={taskId}
                currentUserId={currentUserId}
              />
            )}
          </div>
        ) : (
          <div className="py-16 text-center text-muted-foreground text-sm">任務不存在</div>
        )}
      </div>
    </div>
  );
}
