/**
 * GET / PATCH / DELETE /api/time-entries/templates/[id] — Template CRUD (TS-30, Issue #833)
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { validateBody } from "@/lib/validate";
import { success } from "@/lib/api-response";
import { NotFoundError, ForbiddenError } from "@/services/errors";

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100),
});

/** GET — template detail with items (Issue #833) */
export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const userId = session.user.id;
  const { id } = await context.params;

  const template = await prisma.timeEntryTemplate.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) throw new NotFoundError(`Template not found: ${id}`);
  if ((template as unknown as { userId: string }).userId !== userId) {
    throw new ForbiddenError("只能查看自己的模板");
  }

  return success(template);
});

/** PATCH — edit template name (Issue #833) */
export const PATCH = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const userId = session.user.id;
  const { id } = await context.params;

  const template = await prisma.timeEntryTemplate.findUnique({ where: { id } });
  if (!template) throw new NotFoundError(`Template not found: ${id}`);
  if ((template as unknown as { userId: string }).userId !== userId) {
    throw new ForbiddenError("只能編輯自己的模板");
  }

  const raw = await req.json();
  const { name } = validateBody(updateTemplateSchema, raw);

  const updated = await prisma.timeEntryTemplate.update({
    where: { id },
    data: { name },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  return success(updated);
});

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
