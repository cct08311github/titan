"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractItems } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

interface Permission {
  id: string;
  granteeId: string;
  granterId: string;
  permType: string;
  targetId: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  grantee: { id: string; name: string };
  granter: { id: string; name: string };
}

interface User {
  id: string;
  name: string;
  email: string;
}

export function AdminPermissions() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    granteeId: "",
    permType: "",
    targetId: "",
    expiresAt: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterActive !== null) params.set("isActive", String(filterActive));
      const res = await fetch(`/api/permissions?${params}`);
      const body = await res.json();
      setPermissions(extractItems<Permission>(body));
    } catch {
      toast.error("載入權限列表失敗");
    } finally {
      setLoading(false);
    }
  }, [filterActive]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const body = await res.json();
      setUsers(extractItems<User>(body));
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleGrant = async () => {
    if (!form.granteeId || !form.permType.trim()) {
      toast.error("請填寫必填欄位（使用者 & 權限類型）");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, string | undefined> = {
        granteeId: form.granteeId,
        permType: form.permType.trim(),
      };
      if (form.targetId.trim()) body.targetId = form.targetId.trim();
      if (form.expiresAt) body.expiresAt = new Date(form.expiresAt).toISOString();

      const res = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "授予失敗");
      }
      toast.success("已成功授予權限");
      setForm({ granteeId: "", permType: "", targetId: "", expiresAt: "" });
      setShowForm(false);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "授予失敗");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (perm: Permission) => {
    if (!confirm(`確定要撤銷 ${perm.grantee.name} 的 ${perm.permType} 權限嗎？`)) return;
    setRevoking(perm.id);
    try {
      const body: Record<string, string | undefined> = {
        granteeId: perm.granteeId,
        permType: perm.permType,
      };
      if (perm.targetId) body.targetId = perm.targetId;
      const res = await fetch("/api/permissions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "撤銷失敗");
      }
      toast.success("已撤銷權限");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "撤銷失敗");
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">權限管理</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Active filter */}
          <select
            value={filterActive === null ? "" : String(filterActive)}
            onChange={(e) =>
              setFilterActive(e.target.value === "" ? null : e.target.value === "true")
            }
            className={cn(
              "bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground",
              "focus:outline-none focus:ring-1 focus:ring-ring"
            )}
          >
            <option value="">全部狀態</option>
            <option value="true">有效</option>
            <option value="false">已停用</option>
          </select>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            授予權限
          </button>
        </div>
      </div>

      {/* Grant form */}
      {showForm && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">新增權限</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">使用者 *</label>
              <select
                value={form.granteeId}
                onChange={(e) => setForm((f) => ({ ...f, granteeId: e.target.value }))}
                className={cn(
                  "w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground",
                  "focus:outline-none focus:ring-1 focus:ring-ring"
                )}
              >
                <option value="">-- 選擇使用者 --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">權限類型 *</label>
              <input
                type="text"
                value={form.permType}
                onChange={(e) => setForm((f) => ({ ...f, permType: e.target.value }))}
                placeholder="e.g. VIEW_REPORTS"
                className={cn(
                  "w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground",
                  "focus:outline-none focus:ring-1 focus:ring-ring"
                )}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">目標 ID（選填）</label>
              <input
                type="text"
                value={form.targetId}
                onChange={(e) => setForm((f) => ({ ...f, targetId: e.target.value }))}
                placeholder="資源 ID"
                className={cn(
                  "w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground",
                  "focus:outline-none focus:ring-1 focus:ring-ring"
                )}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">到期時間（選填）</label>
              <input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                className={cn(
                  "w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground",
                  "focus:outline-none focus:ring-1 focus:ring-ring"
                )}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleGrant}
              disabled={submitting}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              確認授予
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : permissions.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">尚無權限記錄</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">使用者</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">權限類型</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">目標 ID</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">狀態</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">到期時間</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">授予者</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">建立時間</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {permissions.map((perm) => (
                <tr key={perm.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2 font-medium">{perm.grantee.name}</td>
                  <td className="px-4 py-2">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{perm.permType}</code>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{perm.targetId ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        perm.isActive
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {perm.isActive ? "有效" : "停用"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {perm.expiresAt ? formatDateTime(perm.expiresAt) : "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{perm.granter.name}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {formatDateTime(perm.createdAt)}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleRevoke(perm)}
                      disabled={revoking === perm.id}
                      className="flex items-center gap-1 bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded-md hover:bg-destructive/90 transition-colors disabled:opacity-50"
                    >
                      {revoking === perm.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      撤銷
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
