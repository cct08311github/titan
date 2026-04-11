"use client";

import { useState, useEffect } from "react";
import { Search, Link2, X } from "lucide-react";
import { extractData } from "@/lib/api-client";
import { type AvailableTask, TASK_STATUS_LABEL } from "./kpi-types";

export interface LinkTaskDialogProps {
  kpiId: string;
  onLinked: () => void;
  onClose: () => void;
}

export function LinkTaskDialog({ kpiId, onLinked, onClose }: LinkTaskDialogProps) {
  const [tasks, setTasks] = useState<AvailableTask[]>([]);
  const [taskSearch, setTaskSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/tasks?take=20", { credentials: "include" });
        if (!res.ok) throw new Error("載入任務失敗");
        const body = await res.json();
        const data = extractData<{ items: AvailableTask[] }>(body);
        setTasks(data.items ?? []);
      } catch {
        setError("無法載入任務列表");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = taskSearch.trim()
    ? tasks.filter((t) => t.title.toLowerCase().includes(taskSearch.trim().toLowerCase()))
    : tasks;

  async function handleLink(taskId: string) {
    setLinking(taskId);
    try {
      const res = await fetch(`/api/kpi/${kpiId}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ taskId }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setError(errBody?.message ?? errBody?.error ?? "連結失敗");
        return;
      }
      onLinked();
      onClose();
    } finally {
      setLinking(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-xl shadow-lg w-full max-w-md p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">連結任務</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜尋任務..."
            value={taskSearch}
            onChange={(e) => setTaskSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-accent border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="max-h-60 overflow-y-auto space-y-1">
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">載入中...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">無符合任務</p>
          ) : (
            filtered.map((task) => (
              <button
                key={task.id}
                onClick={() => handleLink(task.id)}
                disabled={linking === task.id}
                className="w-full text-left flex items-center justify-between p-2.5 bg-accent/40 hover:bg-accent/70 rounded-md transition-colors disabled:opacity-50"
              >
                <div>
                  <p className="text-sm text-foreground">{task.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {TASK_STATUS_LABEL[task.status] ?? task.status}
                  </p>
                </div>
                {linking === task.id ? (
                  <span className="text-xs text-muted-foreground">連結中...</span>
                ) : (
                  <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
