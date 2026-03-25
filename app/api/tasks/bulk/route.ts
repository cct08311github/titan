import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validate";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { ForbiddenError } from "@/services/errors";
import { z } from "zod";

const bulkUpdateSchema = z.object({
  taskIds: z.array(z.string()).min(1).max(50),
  updates: z.object({
    status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
    priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
    primaryAssigneeId: z.string().nullable().optional(),
  }).refine(
    (data) => data.status !== undefined || data.priority !== undefined || data.primaryAssigneeId !== undefined,
    { message: "至少需提供一個更新欄位 (status, priority, primaryAssigneeId)" }
  ),
});

/**
 * PATCH /api/tasks/bulk
 * Bulk update tasks. ENGINEER can only update tasks assigned to them.
 * MANAGER can update any tasks.
 */
export const PATCH = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const raw = await req.json();
  const { taskIds, updates } = validateBody(bulkUpdateSchema, raw);

  // ENGINEER ownership check: verify all tasks are assigned to them
  if (session.user.role !== "MANAGER") {
    const tasks = await prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, primaryAssigneeId: true, backupAssigneeId: true },
    });

    const unauthorized = tasks.filter(
      (t) => t.primaryAssigneeId !== session.user.id && t.backupAssigneeId !== session.user.id
    );

    if (unauthorized.length > 0) {
      throw new ForbiddenError("包含未被指派給你的任務，無法批量修改");
    }
  }

  // Build the update data object, only including defined fields
  const data: Record<string, unknown> = {};
  if (updates.status !== undefined) data.status = updates.status;
  if (updates.priority !== undefined) data.priority = updates.priority;
  if (updates.primaryAssigneeId !== undefined) data.primaryAssigneeId = updates.primaryAssigneeId;

  const result = await prisma.task.updateMany({
    where: { id: { in: taskIds } },
    data,
  });

  return success({ updated: result.count });
});
