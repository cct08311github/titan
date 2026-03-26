"use client";

import { useState, useCallback, useRef } from "react";
import { Plus, Trash2, Check, ChevronDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";

type SubTask = {
  id: string;
  title: string;
  done: boolean;
  order: number;
  notes?: string | null;
  result?: string | null;
  completedAt?: string | null;
  assigneeId?: string | null;
};

const resultOptions = [
  { value: "", label: "-- 未選擇 --" },
  { value: "PASS", label: "PASS" },
  { value: "FAIL", label: "FAIL" },
  { value: "BLOCKED", label: "BLOCKED" },
  { value: "N_A", label: "N/A" },
];

const inputCls =
  "w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/60";

interface SubTaskListProps {
  subtasks: SubTask[];
  taskId: string;
  onUpdate?: (subtasks: SubTask[]) => void;
}

export function SubTaskList({ subtasks: initial, taskId, onUpdate }: SubTaskListProps) {
  const [subtasks, setSubtasks] = useState<SubTask[]>(initial);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const doneCount = subtasks.filter((s) => s.done).length;
  const total = subtasks.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const updateSubtask = useCallback(async (id: string, updates: Record<string, unknown>) => {
    const res = await fetch(`/api/subtasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const body = await res.json();
      return extractData<SubTask>(body);
    }
    return null;
  }, []);

  const debouncedUpdate = useCallback((id: string, field: string, value: string) => {
    if (debounceTimers.current[`${id}-${field}`]) {
      clearTimeout(debounceTimers.current[`${id}-${field}`]);
    }
    debounceTimers.current[`${id}-${field}`] = setTimeout(() => {
      updateSubtask(id, { [field]: value || null });
    }, 500);
  }, [updateSubtask]);

  async function toggleDone(subtask: SubTask) {
    setLoading(subtask.id);
    try {
      const updated = await updateSubtask(subtask.id, { done: !subtask.done });
      if (updated) {
        const newList = subtasks.map((s) =>
          s.id === subtask.id ? { ...s, done: updated.done, completedAt: updated.completedAt } : s
        );
        setSubtasks(newList);
        onUpdate?.(newList);
      }
    } finally {
      setLoading(null);
    }
  }

  async function updateResult(subtask: SubTask, result: string) {
    const newList = subtasks.map((s) =>
      s.id === subtask.id ? { ...s, result: result || null } : s
    );
    setSubtasks(newList);
    onUpdate?.(newList);
    await updateSubtask(subtask.id, { result: result || null });
  }

  function updateNotes(subtask: SubTask, notes: string) {
    const newList = subtasks.map((s) =>
      s.id === subtask.id ? { ...s, notes } : s
    );
    setSubtasks(newList);
    debouncedUpdate(subtask.id, "notes", notes);
  }

  async function deleteSubtask(id: string) {
    setLoading(id);
    try {
      const res = await fetch(`/api/subtasks/${id}`, { method: "DELETE" });
      if (res.ok) {
        const updated = subtasks.filter((s) => s.id !== id);
        setSubtasks(updated);
        onUpdate?.(updated);
        if (expanded === id) setExpanded(null);
      }
    } finally {
      setLoading(null);
    }
  }

  async function addSubtask() {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/subtasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, title: newTitle.trim(), order: subtasks.length }),
      });
      if (res.ok) {
        const body = await res.json();
        const created = extractData<SubTask>(body);
        const updated = [...subtasks, created];
        setSubtasks(updated);
        onUpdate?.(updated);
        setNewTitle("");
      }
    } finally {
      setAdding(false);
    }
  }

  function formatCompletedAt(dateStr: string | null | undefined): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `完成於 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      {total > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {doneCount}/{total}
          </span>
        </div>
      )}

      {/* Subtask items */}
      <div className="space-y-1">
        {subtasks.map((subtask) => (
          <div key={subtask.id} className="rounded-lg border border-transparent hover:border-border transition-colors">
            {/* Collapsed row */}
            <div
              className={cn(
                "flex items-center gap-2 group px-2 py-1.5 rounded-md transition-colors",
                loading === subtask.id && "opacity-50"
              )}
            >
              <button
                onClick={() => toggleDone(subtask)}
                disabled={loading === subtask.id}
                className={cn(
                  "flex-shrink-0 h-4 w-4 rounded border transition-colors flex items-center justify-center",
                  subtask.done
                    ? "bg-emerald-500 border-emerald-500"
                    : "border-border hover:border-ring/50"
                )}
              >
                {subtask.done && <Check className="h-3 w-3 text-white" />}
              </button>
              <button
                onClick={() => setExpanded(expanded === subtask.id ? null : subtask.id)}
                className="flex-1 flex items-center gap-1.5 text-left min-w-0"
              >
                <span
                  className={cn(
                    "flex-1 text-sm truncate",
                    subtask.done ? "line-through text-muted-foreground" : "text-foreground"
                  )}
                >
                  {subtask.title}
                </span>
                {subtask.result === "FAIL" && (
                  <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                )}
                {subtask.result === "BLOCKED" && (
                  <AlertTriangle className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                )}
                {subtask.done && subtask.completedAt && (
                  <span className="text-[10px] text-emerald-600 flex-shrink-0">
                    {formatCompletedAt(subtask.completedAt)}
                  </span>
                )}
              </button>
              <ChevronDown
                className={cn(
                  "h-3 w-3 text-muted-foreground transition-transform flex-shrink-0",
                  expanded === subtask.id && "rotate-180"
                )}
              />
              <button
                onClick={() => deleteSubtask(subtask.id)}
                disabled={loading === subtask.id}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all flex-shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Expanded accordion */}
            {expanded === subtask.id && (
              <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/50 mx-2">
                {/* Notes */}
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">備註</label>
                  <textarea
                    value={subtask.notes ?? ""}
                    onChange={(e) => updateNotes(subtask, e.target.value)}
                    rows={3}
                    placeholder="執行備註（支援 Markdown 格式）..."
                    className={cn(inputCls, "resize-none text-xs")}
                  />
                </div>

                {/* Result */}
                <div>
                  <label className="block text-[10px] font-medium text-muted-foreground mb-1">執行結果</label>
                  <select
                    value={subtask.result ?? ""}
                    onChange={(e) => updateResult(subtask, e.target.value)}
                    className={cn(inputCls, "text-xs h-8 cursor-pointer")}
                  >
                    {resultOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add new subtask */}
      <div className="flex items-center gap-2 mt-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addSubtask()}
          placeholder="新增子任務..."
          className="flex-1 bg-transparent border-b border-border focus:border-ring text-sm text-foreground placeholder:text-muted-foreground outline-none py-1 transition-colors"
        />
        <button
          onClick={addSubtask}
          disabled={adding || !newTitle.trim()}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
