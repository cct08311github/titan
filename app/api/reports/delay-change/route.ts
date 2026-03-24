import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get("startDate");
  const endParam = searchParams.get("endDate");
  const now = new Date();

  const startDate = startParam
    ? new Date(startParam)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = endParam
    ? new Date(endParam)
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const changes = await prisma.taskChange.findMany({
    where: {
      changedAt: { gte: startDate, lte: endDate },
    },
    include: {
      task: { select: { id: true, title: true } },
      changedByUser: { select: { id: true, name: true } },
    },
    orderBy: { changedAt: "asc" },
  });

  const delayChanges = changes.filter((c) => c.changeType === "DELAY");
  const scopeChanges = changes.filter((c) => c.changeType === "SCOPE_CHANGE");

  // Group by date (YYYY-MM-DD)
  const byDateMap = changes.reduce(
    (acc, c) => {
      const dateKey = c.changedAt.toISOString().slice(0, 10);
      if (!acc[dateKey]) {
        acc[dateKey] = { date: dateKey, delayCount: 0, scopeChangeCount: 0, total: 0 };
      }
      if (c.changeType === "DELAY") acc[dateKey].delayCount += 1;
      if (c.changeType === "SCOPE_CHANGE") acc[dateKey].scopeChangeCount += 1;
      acc[dateKey].total += 1;
      return acc;
    },
    {} as Record<string, { date: string; delayCount: number; scopeChangeCount: number; total: number }>
  );

  return success({
    period: { start: startDate, end: endDate },
    delayCount: delayChanges.length,
    scopeChangeCount: scopeChanges.length,
    total: changes.length,
    byDate: Object.values(byDateMap).sort((a, b) => a.date.localeCompare(b.date)),
    changes,
  });
});
