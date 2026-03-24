import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { UnauthorizedError, NotFoundError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { updateDocumentSchema } from "@/validators/document-validators";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";

export const GET = apiHandler(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session) throw new UnauthorizedError();

  const { id } = await context.params;
  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true } },
      updater: { select: { id: true, name: true } },
      children: {
        select: { id: true, title: true, slug: true },
        orderBy: { title: "asc" },
      },
    },
  });

  if (!doc) throw new NotFoundError("文件不存在");
  return success(doc);
});

export const PUT = apiHandler(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const { id } = await context.params;
  const raw = await req.json();
  const { title, content, parentId } = validateBody(updateDocumentSchema, raw);

  const existing = await prisma.document.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("文件不存在");

  const newVersion = existing.version + 1;

  await prisma.documentVersion.create({
    data: {
      documentId: id,
      content: existing.content,
      version: existing.version,
      createdBy: session.user.id,
    },
  });

  const updates: Record<string, unknown> = { updatedBy: session.user.id, version: newVersion };
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (parentId !== undefined) updates.parentId = parentId || null;

  const doc = await prisma.document.update({
    where: { id },
    data: updates,
    include: {
      creator: { select: { id: true, name: true } },
      updater: { select: { id: true, name: true } },
    },
  });

  return success(doc);
});

export const DELETE = withManager(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  await prisma.document.delete({ where: { id } });
  return success({ success: true });
});
