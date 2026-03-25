"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", { username, password, redirect: false });
    if (result?.error) {
      if (result.code === "credentials") {
        setError("帳號或密碼錯誤");
      } else if (result.code?.includes("locked")) {
        setError("帳號已被鎖定，請等待 15 分鐘後再試");
      } else {
        setError("登入失敗，請稍後再試");
      }
      setLoading(false);
    }
    else { router.push("/dashboard"); }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-card rounded-2xl shadow-lg p-8">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <span className="text-lg font-bold text-primary-foreground">T</span>
            </div>
            <span className="text-xl font-semibold tracking-tight text-foreground">TITAN</span>
          </div>
          <p className="text-sm text-muted-foreground">銀行 IT 團隊工作管理系統</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="username">帳號</label>
            <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full h-11 px-3.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              placeholder="請輸入帳號" required autoComplete="username" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="password">密碼</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 px-3.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              placeholder="請輸入密碼" required autoComplete="current-password" />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-danger bg-danger/5 border border-danger/10 rounded-lg px-3 py-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-danger flex-shrink-0" />{error}
            </div>
          )}
          <button type="submit" disabled={loading}
            className="w-full h-11 bg-primary text-primary-foreground rounded-lg text-sm font-medium shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
            {loading ? (<><Loader2 className="h-4 w-4 animate-spin" />登入中...</>) : "登入"}
          </button>
        </form>
      </div>
      <p className="text-center text-[11px] text-muted-foreground/50 mt-6">&copy; 2026 TITAN v1.0</p>
    </div>
  );
}
