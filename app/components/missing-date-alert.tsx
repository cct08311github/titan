"use client";

import { useState } from "react";
import { AlertTriangle, Calendar, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MissingDateTask {
  id: string;
  title: string;
  status: string;
  primaryAssignee?: { name: string } | null;
}

interface MissingDateAlertProps {
  tasks: MissingDateTask[];
  onQuickFill: (taskId: string, startDate: string) => Promise<void>;
}

const STATUS_LABEL: Record<string, string> = {
  BACKLOG: "待辦",
  TODO: "待處理",
  IN_PROGRESS: "進行中",
  REVIEW: "審核中",
  DONE: "已完成",
};

/**
 * 缺少開始日的任務提示清單
 * 允許快速補填開始日
 */
export function MissingDateAlert({ tasks, onQuickFill }: MissingDateAlertProps) {
  const [expanded, setExpanded] = useState(true);
  const [fillingId, setFillingId] = useState<string | null>(null);
  const [dateInputs, setDateInputs] = useState<Record<string, string>>({});

  if (tasks.length === 0) return null;

  async function handleFill(taskId: string) {
    const date = dateInputs[taskId];
    if (!date) return;
    setFillingId(taskId);
    try {
      await onQuickFill(taskId, date);
    } finally {
      setFillingId(null);
    }
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full text-left"
      >
        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
        <span className="text-sm font-medium text-amber-600">
          以下 {tasks.length} 筆任務缺少開始日，無法顯示在甘特圖
        </span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-amber-500 ml-auto" />
        ) : (
          <ChevronRight className="h-4 w-4 text-amber-500 ml-auto" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 p-2 bg-background/60 rounded-md"
            >
              <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground truncate">{task.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    {STATUS_LABEL[task.status] ?? task.status}
                  </span>
                  {task.primaryAssignee && (
                    <span className="text-[10px] text-muted-foreground">
                      {task.primaryAssignee.name}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <input
                  type="date"
                  value={dateInputs[task.id] || ""}
                  onChange={(e) =>
                    setDateInputs((prev) => ({ ...prev, [task.id]: e.target.value }))
                  }
                  className="text-xs bg-accent border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={() => handleFill(task.id)}
                  disabled={!dateInputs[task.id] || fillingId === task.id}
                  className={cn(
                    "text-xs px-2 py-1 rounded transition-colors",
                    dateInputs[task.id]
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {fillingId === task.id ? "..." : "補填"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
