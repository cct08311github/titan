import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";
import { escapeHtml } from "@/lib/security/sanitize";

type SearchResult = {
  id: string;
  title: string;
  slug: string;
  parentId: string | null;
  snippet: string;
};

export const GET = withAuth(async (req: NextRequest) => {

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return success([]);

  // Try PostgreSQL full-text search first (works well for English/space-delimited text)
  const ftsResults = await prisma.$queryRaw<SearchResult[]>`
    SELECT
      id,
      title,
      slug,
      "parentId",
      LEFT(content, 200) AS snippet
    FROM documents
    WHERE to_tsvector('simple', title || ' ' || content) @@ plainto_tsquery('simple', ${q})
    ORDER BY ts_rank(to_tsvector('simple', title || ' ' || content), plainto_tsquery('simple', ${q})) DESC
    LIMIT 20
  `;

  // If FTS returned results, escape snippets before returning
  if (ftsResults.length > 0) {
    const escaped = ftsResults.map((r) => ({
      ...r,
      snippet: escapeHtml(r.snippet),
    }));
    return success(escaped);
  }

  // Fallback: ILIKE search for CJK text (Chinese/Japanese/Korean)
  // PostgreSQL full-text search with 'simple' config tokenizes by whitespace,
  // which doesn't work for CJK languages where words aren't space-separated.
  const likeResults = await prisma.document.findMany({
    where: { deletedAt: null,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      title: true,
      slug: true,
      parentId: true,
      content: true,
    },
    take: 20,
  });

  const mapped: SearchResult[] = likeResults.map((doc) => ({
    id: doc.id,
    title: doc.title,
    slug: doc.slug,
    parentId: doc.parentId,
    snippet: escapeHtml(doc.content.substring(0, 200)),
  }));

  return success(mapped);
});
