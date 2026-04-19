"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";
import { useConfirmDialog } from "@/app/components/ui/alert-dialog";
import {
  Users,
  Plus,
  Pencil,
  Search,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { extractItems } from "@/lib/api-client";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";

// ── Types ──────────────────────────────────────────────────────────────────

interface UserEntry {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "管理員",
  MANAGER: "經理",
  ENGINEER: "工程師",
};

const ROLE_OPTIONS = ["ADMIN", "MANAGER", "ENGINEER"] as const;

// ── Component ──────────────────────────────────────────────────────────────

export function UserManagementSection() {
  const { confirmDialog, ConfirmDialog } = useConfirmDialog();
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<string>("ENGINEER");
  const [formPassword, setFormPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ includeSuspended: "true" });
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      const res = await fetch(`/api/users?${params.toString()}`);
      if (!res.ok) throw new Error("使用者清單載入失敗");
      const body = await res.json();
      setUsers(extractItems<UserEntry>(body));
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => { load(); }, [load]);

  function openAddModal() {
    setFormName("");
    setFormEmail("");
    setFormRole("ENGINEER");
    setFormPassword("");
    setFormError(null);
    setEditingUser(null);
    setShowAddModal(true);
  }

  function openEditModal(user: UserEntry) {
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormPassword("");
    setFormError(null);
    setEditingUser(user);
    setShowAddModal(true);
  }

  function closeModal() {
    setShowAddModal(false);
    setEditingUser(null);
    setFormError(null);
  }

  async function handleSubmitAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          email: formEmail.trim(),
          role: formRole,
          password: formPassword,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setFormError(errBody?.message ?? "建立使用者失敗");
        return;
      }
      toast.success("使用者已建立");
      closeModal();
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: formName.trim(),
        role: formRole,
      };
      // Only send password if changed
      if (formPassword) payload.password = formPassword;
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setFormError(errBody?.message ?? "更新使用者失敗");
        return;
      }
      toast.success("使用者已更新");
      closeModal();
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(user: UserEntry) {
    const action = user.isActive ? "suspend" : "unsuspend";
    const confirmMsg = user.isActive
      ? `確定要停用「${user.name}」？`
      : `確定要啟用「${user.name}」？`;
    const ok = await confirmDialog({ title: confirmMsg, description: "此操作可能影響該使用者的存取權限", confirmLabel: "確認", variant: "destructive" });
    if (!ok) return;

    try {
      let res: Response;
      if (user.isActive) {
        res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      } else {
        res = await fetch(`/api/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: true }),
        });
      }
      if (res.ok) {
        toast.success(user.isActive ? `已停用「${user.name}」` : `已啟用「${user.name}」`);
        await load();
      } else {
        toast.error(`${action === "suspend" ? "停用" : "啟用"}失敗`);
      }
    } catch {
      toast.error(`${action === "suspend" ? "停用" : "啟用"}失敗`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          使用者管理
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-card hover:bg-accent text-foreground rounded-lg border border-border shadow-sm transition-all"
          >
            <RefreshCw className="h-3 w-3" />
            重新整理
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-sm transition-all"
          >
            <Plus className="h-3 w-3" />
            新增使用者
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="搜尋姓名或 Email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-sm bg-card border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* User list */}
      {loading ? (
        <PageLoading message="載入使用者..." className="py-8" />
      ) : error ? (
        <PageError message={error} onRetry={load} className="py-8" />
      ) : users.length === 0 ? (
        <PageEmpty
          icon={<Users className="h-6 w-6" />}
          title="尚無使用者"
          description="點擊「新增使用者」來建立第一個帳號"
          className="py-12"
        />
      ) : (
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-accent/30">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">姓名</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">角色</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">狀態</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">建立時間</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-2 text-sm font-medium">{user.name}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-2">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        user.role === "ADMIN" ? "text-purple-600 bg-purple-500/10" :
                        user.role === "MANAGER" ? "text-blue-600 bg-blue-500/10" :
                        "text-foreground bg-accent"
                      )}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        user.isActive
                          ? "text-success bg-success/10"
                          : "text-danger bg-danger/10"
                      )}>
                        {user.isActive ? "啟用" : "停用"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(user.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(user)}
                          title="編輯"
                          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => toggleActive(user)}
                          title={user.isActive ? "停用" : "啟用"}
                          className={cn(
                            "text-xs px-2 py-1 rounded-lg font-medium transition-colors",
                            user.isActive
                              ? "text-danger hover:bg-danger/10"
                              : "text-success hover:bg-success/10"
                          )}
                        >
                          {user.isActive ? "停用" : "啟用"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">共 {users.length} 位使用者</p>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
          <div className="bg-card rounded-xl shadow-lg border border-border w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 id="user-modal-title" className="text-sm font-semibold">
                {editingUser ? "編輯使用者" : "新增使用者"}
              </h3>
              <button onClick={closeModal} className="p-1 rounded hover:bg-accent transition-colors" aria-label="關閉">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={editingUser ? handleSubmitEdit : handleSubmitAdd} className="p-5 space-y-4">
              {formError && (
                <div className="text-xs text-danger bg-danger/10 px-3 py-2 rounded-lg">
                  {formError}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">姓名</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              {!editingUser && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Email</label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">角色</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  {editingUser ? "密碼（留空則不變更）" : "初始密碼"}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingUser ? "不變更請留空" : ""}
                  className="w-full px-3 py-1.5 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="text-[10px] text-muted-foreground">
                  至少 12 字元，含大小寫、數字及特殊字元
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-sm transition-all disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                  {editingUser ? "儲存" : "建立"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}
