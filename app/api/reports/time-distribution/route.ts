/**
 * GET /api/reports/time-distribution?dateFrom=&dateTo=
 *
 * R-2: Time distribution report — returns hours by user and category
 * for rendering a stacked bar chart.
 *
 * - Manager sees all team members
 * - Member sees only their own data
 *
 * Fixes #837
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { aggregateTimeDistribution } from "@/lib/time-distribution";

export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const { searchParams } = new URL(req.url);

  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const isManager = session.user.role === "MANAGER";

  // Default range: current month
  const now = new Date();
  const startDate = dateFrom ? new Date(dateFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = dateTo ? new Date(dateTo + "T23:59:59.999Z") : now;

  const where: Record<string, unknown> = {
    date: { gte: startDate, lte: endDate },
  };
  if (!isManager) {
    where.userId = session.user.id;
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  const result = aggregateTimeDistribution(entries);

  return success({
    dateFrom: startDate.toISOString(),
    dateTo: endDate.toISOString(),
    ...result,
  });
});
