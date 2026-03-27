import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";

export const GET = withAuth(async () => {
  const session = await requireAuth();

  const assignments = await prisma.readingListAssignment.findMany({
    where: { userId: session.user.id },
    include: {
      readingList: {
        include: {
          items: {
            include: {
              document: { select: { id: true, title: true, slug: true, status: true } },
            },
            orderBy: { sortOrder: "asc" },
          },
          creator: { select: { id: true, name: true } },
        },
      },
      assigner: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch read records for all assigned reading lists
  const readingListIds = assignments.map((a) => a.readingListId);

  const readRecords = await prisma.readingListItemRead.findMany({
    where: {
      userId: session.user.id,
      readingListId: { in: readingListIds },
    },
    select: { readingListId: true, documentId: true },
  });

  const readSet = new Set(
    readRecords.map((r) => `${r.readingListId}:${r.documentId}`)
  );

  const result = assignments.map((a) => {
    const totalItems = a.readingList.items.length;
    const requiredItems = a.readingList.items.filter((i) => i.required);
    const readCount = a.readingList.items.filter((i) =>
      readSet.has(`${a.readingListId}:${i.documentId}`)
    ).length;
    const requiredReadCount = requiredItems.filter((i) =>
      readSet.has(`${a.readingListId}:${i.documentId}`)
    ).length;

    return {
      id: a.id,
      readingList: {
        ...a.readingList,
        items: a.readingList.items.map((item) => ({
          ...item,
          isRead: readSet.has(`${a.readingListId}:${item.documentId}`),
        })),
      },
      assigner: a.assigner,
      completedAt: a.completedAt,
      createdAt: a.createdAt,
      progress: {
        total: totalItems,
        read: readCount,
        requiredTotal: requiredItems.length,
        requiredRead: requiredReadCount,
        pct: totalItems > 0 ? Math.round((readCount / totalItems) * 100) : 0,
      },
    };
  });

  return success(result);
});
