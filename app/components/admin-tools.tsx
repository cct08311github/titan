"use client";

import { useState, useEffect, useCallback } from "react";
import { Wrench, Key, Unlock, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";
import { toast } from "sonner";

type User = { id: string; name: string; email: string };

type AuditQueueStatus = { depth: number; oldestTimestamp: string | null };

const selectCls =
  "bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors cursor-pointer w-full";

// ─── Audit Queue Card ────────────────────────────────────────────────────────

function AuditQueueCard() {
  const [status, setStatus] = useState<AuditQueueStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/admin/audit-queue");
      if (res.ok) {
        const body = await res.json();
        const data = extractData<AuditQueueStatus>(body);
        if (data) setStatus(data);
      } else {
        toast.error("無法取得 Audit Queue 狀態");
      }
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  async function retryQueue() {
    setRetrying(true);
    try {
      const res = await fetch("/api/admin/audit-queue", { method: "POST" });
      if (res.ok) {
        const body = await res.json();
        const data = extractData<{ processed: number }>(body);
        toast.success(`重試完成，處理 ${data?.processed ?? 0} 筆`);
        fetchStatus();
      } else {
        toast.error("重試失敗");
      }
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Audit Queue</h3>
      </div>

      <div className="text-sm text-muted-foreground space-y-1">
        {loadingStatus ? (
          <div className="flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>載入中…</span>
          </div>
        ) : status ? (
          <>
            <div>
              深度：
              <span className={cn("font-medium ml-1", status.depth > 0 ? "text-yellow-400" : "text-emerald-400")}>
                {status.depth}
              </span>
            </div>
            <div>
              最舊時間戳：
              <span className="font-medium ml-1 text-foreground">
                {status.oldestTimestamp
                  ? new Date(status.oldestTimestamp).toLocaleString("zh-TW")
                  : "—"}
              </span>
            </div>
          </>
        ) : (
          <span>—</span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={fetchStatus}
          disabled={loadingStatus}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border bg-background text-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loadingStatus && "animate-spin")} />
          重新整理
        </button>
        <button
          onClick={retryQueue}
          disabled={retrying || loadingStatus}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          重試佇列
        </button>
      </div>
    </div>
  );
}

// ─── Reset Token Card ────────────────────────────────────────────────────────

function ResetTokenCard({ users }: { users: User[] }) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    token: string;
    expiresAt: string;
    expiresInMinutes: number;
    userName: string;
  } | null>(null);

  async function generateToken() {
    if (!selectedUserId) {
      toast.error("請選擇使用者");
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/generate-reset-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      if (res.ok) {
        const body = await res.json();
        const data = extractData<{
          token: string;
          expiresAt: string;
          expiresInMinutes: number;
          userName: string;
        }>(body);
        if (data) {
          setResult(data);
          toast.success("OTP 已產生");
        }
      } else {
        const errBody = await res.json().catch(() => ({}));
        toast.error(errBody?.message ?? errBody?.error ?? "產生 OTP 失敗");
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Key className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">產生重設密碼 OTP</h3>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">選擇使用者</label>
        <select
          value={selectedUserId}
          onChange={(e) => { setSelectedUserId(e.target.value); setResult(null); }}
          className={selectCls}
          aria-label="選擇使用者"
        >
          <option value="">— 請選擇 —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.email})
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={generateToken}
        disabled={generating || !selectedUserId}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Key className="h-3.5 w-3.5" />}
        產生 OTP
      </button>

      {result && (
        <div className="space-y-2">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 space-y-1">
            <div className="text-xs text-muted-foreground">
              {result.userName} 的重設 OTP
            </div>
            <div className="font-mono text-xl font-bold tracking-widest text-foreground">
              {result.token}
            </div>
            <div className="text-xs text-muted-foreground">
              到期：{new Date(result.expiresAt).toLocaleString("zh-TW")}（{result.expiresInMinutes} 分鐘後）
            </div>
          </div>
          <p className="text-xs text-yellow-400">
            請透過安全管道傳遞此 OTP
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Unlock Account Card ─────────────────────────────────────────────────────

function UnlockAccountCard({ users }: { users: User[] }) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  async function unlockAccount() {
    if (!selectedUserId) {
      toast.error("請選擇使用者");
      return;
    }
    setUnlocking(true);
    try {
      const res = await fetch("/api/admin/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        const data = extractData<{ message: string; unlocked: boolean }>(body);
        toast.success(data?.message ?? "帳號已解鎖");
        setSelectedUserId("");
      } else {
        toast.error(body?.message ?? body?.error ?? "解鎖失敗");
      }
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Unlock className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">解鎖帳號</h3>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">選擇使用者</label>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className={selectCls}
          aria-label="選擇使用者"
        >
          <option value="">— 請選擇 —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.email})
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={unlockAccount}
        disabled={unlocking || !selectedUserId}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {unlocking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}
        解鎖帳號
      </button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function AdminTools() {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/users");
        if (res.ok) {
          const body = await res.json();
          const items: User[] = Array.isArray(body?.data?.items)
            ? body.data.items
            : Array.isArray(body?.data)
            ? body.data
            : [];
          setUsers(items);
        }
      } finally {
        setLoadingUsers(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Wrench className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">系統工具</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AuditQueueCard />
        {loadingUsers ? (
          <>
            {[1, 2].map((i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 flex items-center justify-center h-40">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ))}
          </>
        ) : (
          <>
            <ResetTokenCard users={users} />
            <UnlockAccountCard users={users} />
          </>
        )}
      </div>
    </div>
  );
}
