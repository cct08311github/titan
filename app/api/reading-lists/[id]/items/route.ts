import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withManager } from "@/lib/auth-middleware";
import { validateBody } from "@/lib/validate";
import { addReadingListItemSchema } from "@/validators/reading-list-validators";
import { success, error } from "@/lib/api-response";
import { NotFoundError, ValidationError } from "@/services/errors";

export const POST = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const raw = await req.json();
  const body = validateBody(addReadingListItemSchema, raw);

  const list = await prisma.readingList.findUnique({ where: { id } });
  if (!list) throw new NotFoundError("閱讀清單不存在");

  const doc = await prisma.document.findUnique({ where: { id: body.documentId } });
  if (!doc) throw new NotFoundError("文件不存在");

  const existing = await prisma.readingListItem.findUnique({
    where: { readingListId_documentId: { readingListId: id, documentId: body.documentId } },
  });
  if (existing) {
    throw new ValidationError("此文件已在清單中");
  }

  const item = await prisma.readingListItem.create({
    data: {
      readingListId: id,
      documentId: body.documentId,
      sortOrder: body.sortOrder ?? 0,
      required: body.required ?? true,
    },
    include: {
      document: { select: { id: true, title: true, slug: true, status: true } },
    },
  });

  return success(item, 201);
});

export const DELETE = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("itemId");

  if (!itemId) {
    return error("ValidationError", "itemId is required", 400);
  }

  const item = await prisma.readingListItem.findFirst({
    where: { id: itemId, readingListId: id },
  });
  if (!item) throw new NotFoundError("清單項目不存在");

  await prisma.readingListItem.delete({ where: { id: itemId } });
  return success({ deleted: true });
});
