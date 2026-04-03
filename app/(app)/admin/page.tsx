"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";
import { useConfirmDialog } from "@/app/components/ui/alert-dialog";
import {
  Database,
  Shield,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  HardDrive,
  Clock,
  Filter,
  Users,
  Plus,
  Pencil,
  Search,
  X,
  Loader2,
  Tag,
  Check,
  Trash2,
  ToggleLeft,
  ToggleRight,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData, extractItems } from "@/lib/api-client";
import { PageLoading, PageError, PageEmpty } from "@/app/components/page-states";

// ── Types ──────────────────────────────────────────────────────────────────

interface BackupInfo {
  name: string;
  date: string;
  sizeMB: number;
}

interface BackupStatus {
  backupRoot: string;
  lastBackupTime: string | null;
  backupCount: number;
  totalSizeMB: number;
  recentBackups: BackupInfo[];
  lastLogLines: string[];
}

interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  detail: string | null;
  ipAddress: string | null;
  createdAt: string;
}

// ── Backup Status Section ──────────────────────────────────────────────────

function BackupStatusSection() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/backup-status");
      if (!res.ok) throw new Error("備份狀態載入失敗");
      const body = await res.json();
      setStatus(extractData<BackupStatus>(body));
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageLoading message="載入備份狀態..." className="py-8" />;
  if (error) return <PageError message={error} onRetry={load} className="py-8" />;
  if (!status) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          備份狀態
        </h2>
        <button
          onClick={() => load()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-card hover:bg-accent text-foreground rounded-lg border border-border shadow-sm transition-all"
        >
          <RefreshCw className="h-3 w-3" />
          重新整理
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl shadow-card p-4">
          <p className="text-xs text-muted-foreground">最後備份時間</p>
          <p className="text-sm font-semibold mt-1">
            {status.lastBackupTime ?? "尚無備份"}
          </p>
        </div>
        <div className="bg-card rounded-xl shadow-card p-4">
          <p className="text-xs text-muted-foreground">備份總數</p>
          <p className="text-sm font-semibold mt-1">{status.backupCount}</p>
        </div>
        <div className="bg-card rounded-xl shadow-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <HardDrive className="h-3 w-3" /> 總容量
          </p>
          <p className="text-sm font-semibold mt-1">{status.totalSizeMB} MB</p>
        </div>
        <div className="bg-card rounded-xl shadow-card p-4">
          <p className="text-xs text-muted-foreground">備份路徑</p>
          <p className="text-xs font-mono mt-1 truncate">{status.backupRoot}</p>
        </div>
      </div>

      {/* Recent backups table */}
      {status.recentBackups.length > 0 ? (
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium">最近備份</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-accent/30">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">名稱</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">日期</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">大小 (MB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {status.recentBackups.map((b) => (
                  <tr key={b.name} className="hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-2 font-mono text-xs">{b.name}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{b.date}</td>
                    <td className="px-4 py-2 text-xs text-right tabular-nums">{b.sizeMB}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <PageEmpty
          icon={<Database className="h-6 w-6" />}
          title="尚無備份紀錄"
          description="備份腳本執行後，此處將顯示備份歷史紀錄"
          className="py-8"
        />
      )}

      {/* Log viewer */}
      {status.lastLogLines.length > 0 && (
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium">備份日誌（最近 20 行）</h3>
          </div>
          <pre className="p-4 text-xs font-mono text-muted-foreground bg-accent/10 overflow-x-auto max-h-64 overflow-y-auto">
            {status.lastLogLines.join("\n")}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Audit Log Section ──────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const ACTION_LABELS: Record<string, string> = {
  CREATE: "建立",
  UPDATE: "更新",
  DELETE: "刪除",
  LOGIN: "登入",
  LOGOUT: "登出",
  EXPORT: "匯出",
  IMPORT: "匯入",
  PASSWORD_CHANGE: "變更密碼",
};

function AuditLogSection() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async (requestedPage = 0) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(requestedPage * PAGE_SIZE),
      });
      if (actionFilter) params.set("action", actionFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const res = await fetch(`/api/audit?${params.toString()}`);
      if (!res.ok) throw new Error("稽核日誌載入失敗");
      const body = await res.json();
      setLogs(extractItems<AuditLogEntry>(body));
      setTotal(body?.data?.total ?? body?.total ?? extractItems<AuditLogEntry>(body).length);
      setPage(requestedPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [actionFilter, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  // Server-side pagination — logs already represent the current page
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pagedLogs = logs;

  // Derive unique actions for filter dropdown
  const uniqueActions = Array.from(new Set(logs.map((l) => l.action))).sort();

  if (loading) return <PageLoading message="載入稽核日誌..." className="py-8" />;
  if (error) return <PageError message={error} onRetry={() => load(0)} className="py-8" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          稽核日誌
        </h2>
        <button
          onClick={() => load()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-card hover:bg-accent text-foreground rounded-lg border border-border shadow-sm transition-all"
        >
          <RefreshCw className="h-3 w-3" />
          重新整理
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <Filter className="h-3 w-3" /> 操作類型
          </label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">全部</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABELS[a] ?? a}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> 起始日期
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); }}
            className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> 結束日期
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); }}
            className="px-3 py-1.5 text-sm bg-card border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {(actionFilter || dateFrom || dateTo) && (
          <button
            onClick={() => { setActionFilter(""); setDateFrom(""); setDateTo(""); }}
            className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            清除篩選
          </button>
        )}
      </div>

      {/* Table */}
      {logs.length === 0 ? (
        <PageEmpty
          icon={<Shield className="h-6 w-6" />}
          title="尚無稽核紀錄"
          description="系統操作（登入、資料變更、匯出等）將自動記錄在此"
          className="py-12"
        />
      ) : (
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-accent/30">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">時間</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">操作</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">資源類型</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">資源 ID</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">詳情</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pagedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-2 text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        log.action === "DELETE" ? "text-danger bg-danger/10" :
                        log.action === "CREATE" ? "text-success bg-success/10" :
                        log.action === "LOGIN" ? "text-blue-500 bg-blue-500/10" :
                        "text-foreground bg-accent"
                      )}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">{log.resourceType}</td>
                    <td className="px-4 py-2 text-xs font-mono text-muted-foreground truncate max-w-[120px]">
                      {log.resourceId ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-[200px]">
                      {log.detail ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs font-mono text-muted-foreground">
                      {log.ipAddress ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              共 {total} 筆，第 {page + 1} / {totalPages} 頁
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0 || loading}
                onClick={() => load(page - 1)}
                className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= totalPages - 1 || loading}
                onClick={() => load(page + 1)}
                className="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── User Management Section — Issue #930 ─────────────────────────────────

interface UserEntry {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "管理員",
  MANAGER: "經理",
  ENGINEER: "工程師",
};

const ROLE_OPTIONS = ["ADMIN", "MANAGER", "ENGINEER"] as const;

function UserManagementSection() {
  const { confirmDialog, ConfirmDialog } = useConfirmDialog();
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Add form state
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
        // Suspend: DELETE /api/users/:id
        res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      } else {
        // Unsuspend: DELETE /api/users/:id?action=unsuspend
        res = await fetch(`/api/users/${user.id}?action=unsuspend`, { method: "DELETE" });
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl shadow-lg border border-border w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold">
                {editingUser ? "編輯使用者" : "新增使用者"}
              </h3>
              <button onClick={closeModal} className="p-1 rounded hover:bg-accent transition-colors">
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

// ── Category Management Section ───────────────────────────────────────────

interface ProjectCategory {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

function CategoryManagementSection() {
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // Inline create form
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSortOrder, setEditSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  const { ConfirmDialog, confirmDialog } = useConfirmDialog();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = showInactive
        ? "/api/project-categories?includeInactive=true"
        : "/api/project-categories";
      const res = await fetch(url);
      if (!res.ok) throw new Error("載入類別失敗");
      const body = await res.json();
      setCategories(extractData<ProjectCategory[]>(body) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/project-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body.message || "新增失敗");
        return;
      }
      toast.success(`已新增類別「${newName.trim()}」`);
      setNewName("");
      await load();
    } catch {
      toast.error("新增失敗");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(cat: ProjectCategory) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditSortOrder(cat.sortOrder);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/project-categories/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), sortOrder: editSortOrder }),
      });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body.message || "更新失敗");
        return;
      }
      toast.success("類別已更新");
      setEditingId(null);
      await load();
    } catch {
      toast.error("更新失敗");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(cat: ProjectCategory) {
    const action = cat.isActive ? "停用" : "啟用";
    if (cat.isActive) {
      const ok = await confirmDialog({
        title: `確定要停用「${cat.name}」？`,
        description: "停用後此類別將不再出現在下拉選單中",
        confirmLabel: "停用",
        cancelLabel: "取消",
        variant: "destructive",
      });
      if (!ok) return;
    }

    try {
      if (cat.isActive) {
        // Soft-delete
        const res = await fetch(`/api/project-categories/${cat.id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error();
      } else {
        // Re-activate
        const res = await fetch(`/api/project-categories/${cat.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: true }),
        });
        if (!res.ok) throw new Error();
      }
      toast.success(`已${action}「${cat.name}」`);
      await load();
    } catch {
      toast.error(`${action}失敗`);
    }
  }

  if (loading) return <PageLoading message="載入類別..." className="py-8" />;
  if (error) return <PageError message={error} onRetry={load} className="py-8" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          項目類別管理
        </h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-border"
            />
            顯示停用
          </label>
          <button
            onClick={() => load()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-card hover:bg-accent text-foreground rounded-lg border border-border shadow-sm transition-all"
          >
            <RefreshCw className="h-3 w-3" />
            重新整理
          </button>
        </div>
      </div>

      {/* Inline add form */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="輸入新類別名稱..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          className="flex-1 max-w-xs px-3 py-1.5 text-sm bg-card border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !newName.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-sm transition-all disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          新增類別
        </button>
      </div>

      {/* Category table */}
      {categories.length === 0 ? (
        <PageEmpty
          icon={<Tag className="h-6 w-6" />}
          title="尚無項目類別"
          description="點擊「新增類別」建立第一個類別"
          className="py-8"
        />
      ) : (
        <div className="bg-card rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-accent/30">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground w-12">排序</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">名稱</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-muted-foreground w-20">狀態</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground w-32">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((cat) => (
                  <tr key={cat.id} className={cn("hover:bg-accent/20 transition-colors", !cat.isActive && "opacity-50")}>
                    {editingId === cat.id ? (
                      <>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={editSortOrder}
                            onChange={(e) => setEditSortOrder(parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                            className="w-full max-w-xs px-2 py-1 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium",
                            cat.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                          )}>
                            {cat.isActive ? "啟用" : "停用"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={saveEdit}
                              disabled={saving}
                              className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                              title="儲存"
                            >
                              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 text-muted-foreground hover:bg-accent rounded transition-colors"
                              title="取消"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2 text-xs tabular-nums text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <GripVertical className="h-3 w-3 text-muted-foreground/50" />
                            {cat.sortOrder}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm font-medium">{cat.name}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium",
                            cat.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                          )}>
                            {cat.isActive ? "啟用" : "停用"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => startEdit(cat)}
                              className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                              title="編輯"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => toggleActive(cat)}
                              className={cn(
                                "p-1 rounded transition-colors",
                                cat.isActive
                                  ? "text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                                  : "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                              )}
                              title={cat.isActive ? "停用" : "啟用"}
                            >
                              {cat.isActive ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

type AdminTab = "system" | "users" | "categories";


export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>("system");

  // Redirect non-managers
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "MANAGER") {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  if (status === "loading") return <PageLoading />;

  if (session?.user?.role !== "MANAGER") {
    return (
      <PageError
        message="權限不足：僅限管理員存取此頁面"
        className="py-20"
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">系統管理</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          備份狀態、稽核日誌、使用者與類別管理
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center bg-muted rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setActiveTab("system")}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-md transition-colors",
            activeTab === "system"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Database className="h-3.5 w-3.5" />
          系統管理
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-md transition-colors",
            activeTab === "users"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="h-3.5 w-3.5" />
          使用者管理
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-md transition-colors",
            activeTab === "categories"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Tag className="h-3.5 w-3.5" />
          類別管理
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "system" && (
        <div className="space-y-10">
          <BackupStatusSection />
          <AuditLogSection />
        </div>
      )}
      {activeTab === "users" && <UserManagementSection />}
      {activeTab === "categories" && <CategoryManagementSection />}
    </div>
  );
}
