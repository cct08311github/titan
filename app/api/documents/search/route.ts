import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { UnauthorizedError } from "@/services/errors";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getServerSession();
  if (!session) throw new UnauthorizedError();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return success([]);

  const results = await prisma.$queryRaw<
    { id: string; title: string; slug: string; parentId: string | null; snippet: string }[]
  >`
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

  return success(results);
});
