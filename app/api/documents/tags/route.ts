import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";

/**
 * GET /api/documents/tags — Issue #859
 *
 * Returns all distinct tags used across documents.
 */
export const GET = withAuth(async () => {
  const docs = await prisma.document.findMany({
    where: { tags: { isEmpty: false } },
    select: { tags: true },
  });

  const tagSet = new Set<string>();
  for (const doc of docs) {
    for (const tag of doc.tags) {
      tagSet.add(tag);
    }
  }

  const tags = Array.from(tagSet).sort();
  return success(tags);
});
