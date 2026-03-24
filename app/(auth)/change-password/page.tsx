"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PASSWORD_POLICY_DESCRIPTION } from "@/lib/password-policy";

export default function ChangePasswordPage() {
  const router = useRouter();
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
        setError(data.error || "密碼變更失敗");
        setLoading(false);
        return;
      }

      // Success — redirect to dashboard
      router.push("/dashboard");
    } catch {
      setError("系統錯誤，請稍後再試");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-card border border-border rounded-lg p-8 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">變更密碼</h1>
          <p className="text-sm text-muted-foreground mt-2">
            您的密碼已到期或為首次登入，請設定新密碼
          </p>
        </div>

        <div className="mb-4 p-3 bg-muted/50 border border-border rounded-md">
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
              className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
              className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
              className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              required
              minLength={12}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "變更中..." : "變更密碼"}
          </button>
        </form>
      </div>
    </div>
  );
}
