import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { TaskService } from "@/services/task-service";
import { success, error } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { sanitizeHtml } from "@/lib/security/sanitize";

/**
 * Template task structure for bulk creation.
 *
 * POST body:
 * {
 *   "templateName": "季度回顧",
 *   "tasks": [
 *     {
 *       "title": "收集指標數據",
 *       "description": "...",
 *       "priority": "P1",
 *       "category": "PLANNED",
 *       "estimatedHours": 4,
 *       "offsetDays": 0,
 *       "primaryAssigneeId": "..."
 *     }
 *   ]
 * }
 *
 * - offsetDays: days from today to set as dueDate (optional)
 * - All Prisma enums (priority, category, status) are validated by TaskService
 */

interface TemplateTask {
  title: string;
  description?: string;
  priority?: string;
  category?: string;
  status?: string;
  estimatedHours?: number;
  offsetDays?: number;
  primaryAssigneeId?: string;
  backupAssigneeId?: string;
  monthlyGoalId?: string;
  tags?: string[];
}

interface ImportTemplateBody {
  templateName?: string;
  tasks: TemplateTask[];
}

export const POST = withManager(async (req: NextRequest) => {
  const session = await requireAuth();

  let body: ImportTemplateBody;
  try {
    body = await req.json();
  } catch {
    return error("ValidationError", "無效的 JSON 格式", 400);
  }

  if (!body.tasks || !Array.isArray(body.tasks) || body.tasks.length === 0) {
    return error("ValidationError", "tasks 陣列不得為空", 400);
  }

  if (body.tasks.length > 50) {
    return error("ValidationError", "單次匯入最多 50 筆任務", 400);
  }

  const taskService = new TaskService(prisma);
  const created: Array<{ id: string; title: string }> = [];
  const errors: Array<{ index: number; title: string; error: string }> = [];

  for (let i = 0; i < body.tasks.length; i++) {
    const t = body.tasks[i];

    if (!t.title?.trim()) {
      errors.push({ index: i, title: t.title ?? "(empty)", error: "標題為必填" });
      continue;
    }

    const cleanTitle = sanitizeHtml(t.title.trim().slice(0, 500));
    if (!cleanTitle) {
      errors.push({ index: i, title: t.title ?? "(empty)", error: "標題清洗後為空" });
      continue;
    }
    const cleanDescription = t.description ? sanitizeHtml(t.description.slice(0, 5000)) || undefined : undefined;
    const cleanTags = (t.tags ?? []).map(tag => sanitizeHtml(String(tag).slice(0, 100))).filter(Boolean);

    try {
      let dueDate: Date | undefined;
      if (t.offsetDays !== undefined && t.offsetDays !== null) {
        dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + t.offsetDays);
      }

      const task = await taskService.createTask({
        title: cleanTitle,
        description: cleanDescription,
        priority: t.priority ?? "P2",
        category: t.category ?? "PLANNED",
        status: t.status ?? "BACKLOG",
        estimatedHours: t.estimatedHours ?? null,
        dueDate: dueDate ?? null,
        primaryAssigneeId: t.primaryAssigneeId ?? null,
        backupAssigneeId: t.backupAssigneeId ?? null,
        monthlyGoalId: t.monthlyGoalId ?? null,
        tags: cleanTags,
        creatorId: session.user.id,
      });

      created.push({ id: task.id, title: task.title });
    } catch (err) {
      errors.push({
        index: i,
        title: t.title,
        error: err instanceof Error ? err.message : "建立失敗",
      });
    }
  }

  return success(
    {
      templateName: body.templateName ? sanitizeHtml(String(body.templateName).slice(0, 200)) || null : null,
      created: created.length,
      failed: errors.length,
      tasks: created,
      errors,
    },
    201
  );
});
