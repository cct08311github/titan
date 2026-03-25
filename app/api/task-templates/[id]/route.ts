import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { NotFoundError, ForbiddenError } from "@/services/errors";

/**
 * GET /api/task-templates/[id]
 * Returns a single task template by ID.
 */
export const GET = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;

  const template = await prisma.taskTemplate.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true } },
    },
  });

  if (!template) {
    throw new NotFoundError("任務模板不存在");
  }

  return success(template);
});

/**
 * DELETE /api/task-templates/[id]
 * Deletes a task template. Only the creator or MANAGER can delete.
 */
export const DELETE = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;

  const template = await prisma.taskTemplate.findUnique({
    where: { id },
    select: { creatorId: true },
  });

  if (!template) {
    throw new NotFoundError("任務模板不存在");
  }

  if (session.user.role !== "MANAGER" && template.creatorId !== session.user.id) {
    throw new ForbiddenError("僅限模板建立者或管理員可刪除");
  }

  await prisma.taskTemplate.delete({ where: { id } });

  return success({ success: true });
});
