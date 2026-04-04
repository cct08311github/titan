"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardCheck, Loader2, X, Check, XCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractItems } from "@/lib/api-client";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ApprovalType = "TASK_STATUS_CHANGE" | "DELIVERABLE_ACCEPTANCE" | "PLAN_MODIFICATION";
type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

interface ApprovalUser {
  id: string;
  name: string;
  email: string;
}

interface Approval {
  id: string;
  type: ApprovalType;
  resourceId: string;
  resourceType: string;
  reason: string | null;
  status: ApprovalStatus;
  requesterId: string;
  approverId: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  requester: ApprovalUser;
  approver: ApprovalUser | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ApprovalType, string> = {
  TASK_STATUS_CHANGE: "任務狀態變更",
  DELIVERABLE_ACCEPTANCE: "交付物驗收",
  PLAN_MODIFICATION: "計畫修改",
};

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: "待審核",
  APPROVED: "已批准",
  REJECTED: "已拒絕",
};

const STATUS_BADGE_CLASS: Record<ApprovalStatus, string> = {
  PENDING: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  APPROVED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  REJECTED: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

const APPROVAL_TYPES: ApprovalType[] = [
  "TASK_STATUS_CHANGE",
  "DELIVERABLE_ACCEPTANCE",
  "PLAN_MODIFICATION",
];

// ─── Review Dialog (inline) ───────────────────────────────────────────────────

function ReviewDialog({
  approval,
  action,
  onClose,
  onConfirm,
}: {
  approval: Approval;
  action: "APPROVED" | "REJECTED";
  onClose: () => void;
  onConfirm: (reviewNote: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    await onConfirm(note);
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-5 mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-base">
            {action === "APPROVED" ? "批准請求" : "拒絕請求"}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          {TYPE_LABELS[approval.type]} · {approval.requester.name}
        </p>
        <textarea
          className={cn(
            "w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground",
            "focus:outline-none focus:ring-1 focus:ring-ring resize-none",
          )}
          rows={3}
          placeholder="審核備註（選填）"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md font-medium flex items-center gap-1.5 transition-colors",
              action === "APPROVED"
                ? "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                : "bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50",
            )}
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {action === "APPROVED" ? "確認批准" : "確認拒絕"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Request Form ─────────────────────────────────────────────────────────

function NewRequestForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [type, setType] = useState<ApprovalType>("TASK_STATUS_CHANGE");
  const [resourceId, setResourceId] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [reason, setReason] = useState("");
  const [approverId, setApproverId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resourceId.trim() || !resourceType.trim()) {
      toast.error("資源 ID 和資源類型為必填欄位");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          resourceId: resourceId.trim(),
          resourceType: resourceType.trim(),
          reason: reason.trim() || undefined,
          approverId: approverId.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "建立失敗");
      }
      toast.success("已建立簽核請求");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "建立失敗");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = "bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full";

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">新增簽核請求</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">類型</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ApprovalType)}
            className={cn(inputCls, "cursor-pointer")}
          >
            {APPROVAL_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">資源 ID</label>
          <input
            type="text"
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            placeholder="e.g. task-123"
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">資源類型</label>
          <input
            type="text"
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
            placeholder="e.g. TASK"
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">審核人 ID（選填）</label>
          <input
            type="text"
            value={approverId}
            onChange={(e) => setApproverId(e.target.value)}
            placeholder="留空由系統指派"
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-muted-foreground mb-1">申請原因（選填）</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="說明申請原因..."
            rows={2}
            className={cn(inputCls, "resize-none")}
          />
        </div>
        <div className="sm:col-span-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors">
            取消
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            送出請求
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isManager = role === "MANAGER" || role === "ADMIN";

  const [items, setItems] = useState<Approval[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"ALL" | ApprovalStatus>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | ApprovalType>("ALL");
  const [showNewForm, setShowNewForm] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ approval: Approval; action: "APPROVED" | "REJECTED" } | null>(null);

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      const res = await fetch(`/api/approvals?${params}`);
      if (!res.ok) throw new Error("載入失敗");
      const body = await res.json();
      setItems(extractItems<Approval>(body));
      if (body?.data?.pagination) setPagination(body.data.pagination);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter]);

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [statusFilter, typeFilter]);

  async function handleReview(approval: Approval, action: "APPROVED" | "REJECTED", reviewNote: string) {
    try {
      const res = await fetch("/api/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: approval.id, status: action, reviewNote: reviewNote || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "操作失敗");
      }
      toast.success(action === "APPROVED" ? "已批准請求" : "已拒絕請求");
      setReviewTarget(null);
      fetchApprovals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失敗");
    }
  }

  const selectCls = "bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer";

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">簽核管理</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">管理審批請求與簽核流程</p>
        </div>
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
          新增請求
        </button>
      </div>

      {/* New Request Form */}
      {showNewForm && (
        <NewRequestForm
          onClose={() => setShowNewForm(false)}
          onSuccess={() => { setShowNewForm(false); fetchApprovals(); }}
        />
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className={selectCls}>
          <option value="ALL">全部狀態</option>
          <option value="PENDING">待審核</option>
          <option value="APPROVED">已批准</option>
          <option value="REJECTED">已拒絕</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className={selectCls}>
          <option value="ALL">全部類型</option>
          {APPROVAL_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">載入中...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <ClipboardCheck className="h-8 w-8 opacity-30" />
            <p className="text-sm">目前沒有簽核請求</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">類型</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">申請人</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">狀態</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">原因</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">審核人</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">審核時間</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap font-medium">{TYPE_LABELS[item.type]}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{item.requester.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_BADGE_CLASS[item.status])}>
                        {STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <span className="truncate block text-muted-foreground" title={item.reason ?? undefined}>
                        {item.reason ? (item.reason.length > 40 ? item.reason.slice(0, 40) + "…" : item.reason) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {item.approver?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {item.reviewedAt ? new Date(item.reviewedAt).toLocaleDateString("zh-TW") : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isManager && item.status === "PENDING" ? (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setReviewTarget({ approval: item, action: "APPROVED" })}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/20 text-xs font-medium transition-colors"
                          >
                            <Check className="h-3.5 w-3.5" />
                            批准
                          </button>
                          <button
                            onClick={() => setReviewTarget({ approval: item, action: "REJECTED" })}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-rose-600/10 text-rose-600 dark:text-rose-400 hover:bg-rose-600/20 text-xs font-medium transition-colors"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            拒絕
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>共 {pagination.total} 筆，第 {pagination.page} / {pagination.totalPages} 頁</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-40 transition-colors"
            >
              上一頁
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="px-3 py-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-40 transition-colors"
            >
              下一頁
            </button>
          </div>
        </div>
      )}

      {/* Review Dialog */}
      {reviewTarget && (
        <ReviewDialog
          approval={reviewTarget.approval}
          action={reviewTarget.action}
          onClose={() => setReviewTarget(null)}
          onConfirm={(note) => handleReview(reviewTarget.approval, reviewTarget.action, note)}
        />
      )}
    </div>
  );
}
