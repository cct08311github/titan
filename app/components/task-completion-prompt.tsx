"use client";

import { useState } from "react";
import { BookOpen, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractData } from "@/lib/api-client";

type TaskCompletionPromptProps = {
  taskId: string;
  taskTitle: string;
  onDismiss: () => void;
  onCreated?: (docId: string) => void;
};

/**
 * "要留下經驗筆記嗎？" prompt shown after task completion (Issue #969)
 *
 * Creates a knowledge document linked to the completed task.
 */
export function TaskCompletionPrompt({ taskId, taskTitle, onDismiss, onCreated }: TaskCompletionPromptProps) {
  const [creating, setCreating] = useState(false);

  async function createNote() {
    setCreating(true);
    try {
      const content = `# 經驗筆記 — ${taskTitle}\n\n## 任務概述\n- 任務 ID：${taskId}\n- 任務標題：${taskTitle}\n\n## 學到的經驗\n\n\n## 遇到的問題與解決方式\n\n\n## 未來改善建議\n\n`;

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `經驗筆記 — ${taskTitle}`,
          content,
        }),
      });

      if (res.ok) {
        const body = await res.json();
        const doc = extractData<{ id: string }>(body);
        // Link document to task
        await fetch("/api/task-documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, documentId: doc.id }),
        }).catch(() => { /* best effort */ });

        onCreated?.(doc.id);
        onDismiss();
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
          <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            要留下經驗筆記嗎？
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
            「{taskTitle}」已完成。記錄遇到的問題和學到的經驗，幫助團隊下次做得更好。
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={createNote}
              disabled={creating}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors",
                "bg-blue-600 hover:bg-blue-700 text-white"
              )}
            >
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}
              建立經驗筆記
            </button>
            <button
              onClick={onDismiss}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              稍後再說
            </button>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
