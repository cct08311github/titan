/**
 * Subtask progress aggregation — Issue #421
 *
 * Recalculates a parent Task's progressPct based on the completion
 * ratio of its subtasks: (completed / total) * 100.
 *
 * When a task has no subtasks, progressPct is left unchanged
 * (manual control is preserved).
 */

import { prisma } from "@/lib/prisma";

/**
 * Recalculate and update the parent task's progressPct based on
 * the done/total ratio of its subtasks.
 */
export async function recalcParentProgress(taskId: string): Promise<void> {
  const subtasks = await prisma.subTask.findMany({
    where: { taskId },
    select: { done: true },
  });

  // No subtasks — leave progressPct as-is (manual mode)
  if (subtasks.length === 0) return;

  const completed = subtasks.filter((s) => s.done).length;
  const progressPct = Math.round((completed / subtasks.length) * 100);

  await prisma.task.update({
    where: { id: taskId },
    data: { progressPct },
  });
}
