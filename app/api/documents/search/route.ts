import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    if (!q) return NextResponse.json([]);

    // PostgreSQL full-text search using to_tsvector
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

    return NextResponse.json(results);
  } catch (error) {
    console.error("GET /api/documents/search error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
