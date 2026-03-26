/**
 * POST /api/tasks/reorder — Issue #803 (K-1)
 *
 * Batch update task positions within a kanban column.
 * Accepts an array of { id, position, status? } items.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validate";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { logActivity, ActivityAction, ActivityModule } from "@/services/activity-logger";
import { TaskStatusEnum } from "@/validators/shared/enums";

const reorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        position: z.number(),
        status: TaskStatusEnum.optional(),
      })
    )
    .min(1)
    .max(200),
});

export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const { items } = validateBody(reorderSchema, await req.json());

  await prisma.$transaction(
    async (tx) => {
      for (const item of items) {
        const data: Record<string, unknown> = { position: item.position };
        if (item.status) {
          data.status = item.status;
        }
        await tx.task.update({
          where: { id: item.id },
          data,
        });
      }
    },
    { timeout: 15000 }
  );

  // Fire-and-forget activity log
  logActivity({
    userId: session.user.id,
    action: ActivityAction.UPDATE,
    module: ActivityModule.KANBAN,
    targetType: "Task",
    metadata: {
      operation: "reorder",
      count: items.length,
      taskIds: items.map((i) => i.id),
    },
  });

  return success({ updated: items.length });
});
