import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { NotFoundError, ValidationError } from "@/services/errors";

export const POST = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;
  const raw = await req.json();
  const documentId = raw.documentId;

  if (!documentId) {
    throw new ValidationError("documentId 為必填");
  }

  // Verify assignment exists
  const assignment = await prisma.readingListAssignment.findUnique({
    where: { readingListId_userId: { readingListId: id, userId: session.user.id } },
  });
  if (!assignment) throw new NotFoundError("您未被指派此閱讀清單");

  // Verify item exists in list
  const item = await prisma.readingListItem.findUnique({
    where: { readingListId_documentId: { readingListId: id, documentId } },
  });
  if (!item) throw new NotFoundError("此文件不在閱讀清單中");

  // Upsert read record
  await prisma.readingListItemRead.upsert({
    where: {
      readingListId_documentId_userId: {
        readingListId: id,
        documentId,
        userId: session.user.id,
      },
    },
    create: {
      readingListId: id,
      documentId,
      userId: session.user.id,
    },
    update: {
      readAt: new Date(),
    },
  });

  // Check if all required items are read
  const allItems = await prisma.readingListItem.findMany({
    where: { readingListId: id, required: true },
  });

  const readRecords = await prisma.readingListItemRead.findMany({
    where: {
      readingListId: id,
      userId: session.user.id,
      documentId: { in: allItems.map((i) => i.documentId) },
    },
  });

  const readDocIds = new Set(readRecords.map((r) => r.documentId));
  const allRequiredRead = allItems.every((i) => readDocIds.has(i.documentId));

  // Mark assignment as completed if all required items read
  if (allRequiredRead && !assignment.completedAt) {
    await prisma.readingListAssignment.update({
      where: { id: assignment.id },
      data: { completedAt: new Date() },
    });
  }

  return success({ marked: true, allComplete: allRequiredRead });
});
