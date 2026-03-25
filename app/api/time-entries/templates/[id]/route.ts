/**
 * DELETE /api/time-entries/templates/[id] — Delete a template (TS-30)
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { NotFoundError, ForbiddenError } from "@/services/errors";

export const DELETE = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const userId = session.user.id;
  const { id } = await context.params;

  const template = await prisma.timeEntryTemplate.findUnique({ where: { id } });
  if (!template) throw new NotFoundError(`Template not found: ${id}`);

  if ((template as unknown as { userId: string }).userId !== userId) {
    throw new ForbiddenError("只能刪除自己的模板");
  }

  await prisma.timeEntryTemplate.delete({ where: { id } });

  return success({ success: true });
});
