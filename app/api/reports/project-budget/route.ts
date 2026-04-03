import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withManager } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";
import { parseYear } from "@/lib/query-params";

export const GET = withManager(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const year = parseYear(searchParams.get("year"));

  const projects = await prisma.project.findMany({
    where: { year, archivedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      budgetTotal: true,
      budgetActual: true,
      status: true,
    },
    orderBy: { code: "asc" },
  });

  const items = projects.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    budgetTotal: p.budgetTotal ?? 0,
    budgetActual: p.budgetActual ?? 0,
    executionRate:
      p.budgetTotal && p.budgetTotal > 0
        ? Math.round(((p.budgetActual ?? 0) / p.budgetTotal) * 100)
        : 0,
    status: p.status,
  }));

  return success({ year, items });
});
