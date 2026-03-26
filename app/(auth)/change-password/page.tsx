"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { PASSWORD_POLICY_DESCRIPTION } from "@/lib/password-policy";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("新密碼與確認密碼不一致");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || data.error || "密碼變更失敗");
        setLoading(false);
        return;
      }

      // Success — re-signin to refresh JWT session (clears mustChangePassword)
      await signIn("credentials", {
        username: session?.user?.email || "",
        password: newPassword,
        redirect: false,
      });
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("系統錯誤，請稍後再試");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-card rounded-2xl shadow-lg p-8">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">變更密碼</h1>
          <p className="text-sm text-muted-foreground mt-2">
            您的密碼已到期或為首次登入，請設定新密碼
          </p>
        </div>

        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">{PASSWORD_POLICY_DESCRIPTION}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm text-foreground" htmlFor="currentPassword">
              目前密碼
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full h-11 px-3.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              required
              autoComplete="current-password"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-foreground" htmlFor="newPassword">
              新密碼
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full h-11 px-3.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              required
              minLength={12}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-foreground" htmlFor="confirmPassword">
              確認新密碼
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-11 px-3.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              required
              minLength={12}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-primary text-primary-foreground rounded-lg text-sm font-medium shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? "變更中..." : "變更密碼"}
          </button>
        </form>
      </div>
    </div>
  );
}
