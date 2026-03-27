import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { validateBody } from "@/lib/validate";
import { createDocLinkSchema } from "@/validators/knowledge-validators";
import { success } from "@/lib/api-response";
import { NotFoundError, ValidationError } from "@/services/errors";

export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new NotFoundError("文件不存在");

  const [linksFrom, linksTo] = await Promise.all([
    prisma.documentLink.findMany({
      where: { sourceDocId: id },
      include: { targetDoc: { select: { id: true, title: true, slug: true, status: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.documentLink.findMany({
      where: { targetDocId: id },
      include: { sourceDoc: { select: { id: true, title: true, slug: true, status: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return success({ outgoing: linksFrom, incoming: linksTo });
});

export const POST = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const raw = await req.json();
  const body = validateBody(createDocLinkSchema, raw);

  const [sourceDoc, targetDoc] = await Promise.all([
    prisma.document.findUnique({ where: { id } }),
    prisma.document.findUnique({ where: { id: body.targetDocId } }),
  ]);

  if (!sourceDoc) throw new NotFoundError("來源文件不存在");
  if (!targetDoc) throw new NotFoundError("目標文件不存在");
  if (id === body.targetDocId) {
    throw new ValidationError("不可連結至自身");
  }

  const existing = await prisma.documentLink.findUnique({
    where: { sourceDocId_targetDocId: { sourceDocId: id, targetDocId: body.targetDocId } },
  });
  if (existing) {
    throw new ValidationError("連結已存在");
  }

  const link = await prisma.documentLink.create({
    data: {
      sourceDocId: id,
      targetDocId: body.targetDocId,
      linkType: body.linkType,
    },
    include: {
      targetDoc: { select: { id: true, title: true, slug: true, status: true } },
    },
  });

  return success(link, 201);
});

export const DELETE = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const { searchParams } = new URL(req.url);
  const linkId = searchParams.get("linkId");

  if (!linkId) {
    return success({ error: "linkId is required" }, 400);
  }

  const link = await prisma.documentLink.findFirst({
    where: { id: linkId, sourceDocId: id },
  });
  if (!link) throw new NotFoundError("連結不存在");

  await prisma.documentLink.delete({ where: { id: linkId } });
  return success({ deleted: true });
});
