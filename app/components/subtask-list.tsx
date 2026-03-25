"use client";

import { useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";

type SubTask = {
  id: string;
  title: string;
  done: boolean;
  order: number;
};

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

  const doneCount = subtasks.filter((s) => s.done).length;
  const total = subtasks.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  async function toggleDone(subtask: SubTask) {
    setLoading(subtask.id);
    try {
      const res = await fetch(`/api/subtasks/${subtask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !subtask.done }),
      });
      if (res.ok) {
        const updated = subtasks.map((s) =>
          s.id === subtask.id ? { ...s, done: !s.done } : s
        );
        setSubtasks(updated);
        onUpdate?.(updated);
      }
    } finally {
      setLoading(null);
    }
  }

  async function deleteSubtask(id: string) {
    setLoading(id);
    try {
      const res = await fetch(`/api/subtasks/${id}`, { method: "DELETE" });
      if (res.ok) {
        const updated = subtasks.filter((s) => s.id !== id);
        setSubtasks(updated);
        onUpdate?.(updated);
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
          <div
            key={subtask.id}
            className={cn(
              "flex items-center gap-2 group px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors",
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
            <span
              className={cn(
                "flex-1 text-sm",
                subtask.done ? "line-through text-muted-foreground" : "text-foreground"
              )}
            >
              {subtask.title}
            </span>
            <button
              onClick={() => deleteSubtask(subtask.id)}
              disabled={loading === subtask.id}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
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
