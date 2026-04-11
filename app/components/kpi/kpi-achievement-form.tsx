"use client";

import { useState } from "react";

export interface AchievementFormProps {
  kpiId: string;
  onReported: () => void;
  onCancel: () => void;
}

export function AchievementForm({ kpiId, onReported, onCancel }: AchievementFormProps) {
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [period, setPeriod] = useState(defaultPeriod);
  const [actual, setActual] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!period.trim() || !actual.trim()) {
      setError("期間與達成值為必填");
      return;
    }
    const actualNum = parseFloat(actual);
    if (isNaN(actualNum)) {
      setError("達成值必須是有效數字");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/kpi/${kpiId}/achievement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ period: period.trim(), actual: actualNum, note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setError(errBody?.message ?? errBody?.error ?? "回報失敗");
        return;
      }
      onReported();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 border border-border rounded-lg p-4 space-y-3 bg-accent/20">
      <h3 className="text-xs font-medium text-muted-foreground">回報達成值</h3>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">期間 *</label>
          <input
            type="text"
            placeholder="2026-04"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full bg-accent border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">達成值 *</label>
          <input
            type="number"
            step="any"
            placeholder="0"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            className="w-full bg-accent border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-xs text-muted-foreground">備註（選填）</label>
          <textarea
            placeholder="補充說明..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full bg-accent border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting ? "回報中..." : "確認回報"}
        </button>
      </div>
    </form>
  );
}
