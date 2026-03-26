"use client";

import { SubTaskList } from "../subtask-list";

interface TaskSubtaskSectionProps {
  subtasks: { id: string; title: string; done: boolean; order: number; notes?: string | null; result?: string | null; completedAt?: string | null; assigneeId?: string | null }[];
  taskId: string;
}

export function TaskSubtaskSection({ subtasks, taskId }: TaskSubtaskSectionProps) {
  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground mb-2">子任務清單</h3>
      <div className="bg-muted/30 rounded-xl p-3">
        <SubTaskList subtasks={subtasks} taskId={taskId} />
      </div>
    </div>
  );
}
