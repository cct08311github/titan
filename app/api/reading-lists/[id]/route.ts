import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { validateBody } from "@/lib/validate";
import { updateReadingListSchema } from "@/validators/reading-list-validators";
import { success } from "@/lib/api-response";
import { NotFoundError } from "@/services/errors";

export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;

  const list = await prisma.readingList.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true } },
      items: {
        include: {
          document: { select: { id: true, title: true, slug: true, status: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
      assignments: {
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          assigner: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!list) throw new NotFoundError("閱讀清單不存在");
  return success(list);
});

export const PATCH = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const raw = await req.json();
  const body = validateBody(updateReadingListSchema, raw);

  const existing = await prisma.readingList.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("閱讀清單不存在");

  const list = await prisma.readingList.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
    },
    include: {
      creator: { select: { id: true, name: true } },
      _count: { select: { items: true, assignments: true } },
    },
  });

  return success(list);
});

export const DELETE = withManager(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;

  const existing = await prisma.readingList.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("閱讀清單不存在");

  await prisma.readingList.delete({ where: { id } });
  return success({ deleted: true });
});
