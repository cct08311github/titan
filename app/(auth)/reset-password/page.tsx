/**
 * Password Reset Page — Issue #267
 *
 * Self-service password reset using OTP (for air-gapped environments).
 * Flow: User enters email + OTP (received from admin) + new password.
 */
"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "新密碼與確認密碼不一致" });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "密碼長度至少 8 個字元" });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, newPassword }),
      });

      const json = await res.json();

      if (json.ok) {
        setMessage({ type: "success", text: "密碼已成功重設，請使用新密碼登入。" });
        setEmail("");
        setToken("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setMessage({ type: "error", text: json.message || "重設失敗，請檢查重設碼是否正確" });
      }
    } catch {
      setMessage({ type: "error", text: "網路錯誤，請稍後再試" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">重設密碼</h1>
          <p className="text-muted-foreground mt-2">
            請輸入您的 Email 與管理員提供的重設碼
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label htmlFor="token" className="block text-sm font-medium mb-1">
              重設碼（OTP）
            </label>
            <input
              id="token"
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background text-center text-2xl tracking-widest"
              placeholder="000000"
              maxLength={6}
              pattern="[0-9]{6}"
              inputMode="numeric"
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium mb-1">
              新密碼
            </label>
            <input
              id="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background"
              minLength={8}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
              確認新密碼
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background"
              minLength={8}
            />
          </div>

          {message && (
            <div
              className={`p-3 rounded-md text-sm ${
                message.type === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "處理中..." : "重設密碼"}
          </button>
        </form>

        <div className="text-center text-sm">
          <Link href="/login" className="text-primary hover:underline">
            返回登入頁面
          </Link>
        </div>

        <div className="text-center text-xs text-muted-foreground">
          <p>重設碼由管理員產生，有效期限 30 分鐘。</p>
          <p>如未收到重設碼，請聯繫您的主管。</p>
        </div>
      </div>
    </div>
  );
}
