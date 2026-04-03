import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";
import { parseYear } from "@/lib/query-params";

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const year = parseYear(searchParams.get("year"));

  const byStatus = await prisma.project.groupBy({
    by: ["status"],
    where: { year, archivedAt: null },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  const total = byStatus.reduce((s, r) => s + r._count.id, 0);

  return success({
    year,
    total,
    byStatus: byStatus.map((r) => ({
      status: r.status,
      count: r._count.id,
    })),
  });
});
