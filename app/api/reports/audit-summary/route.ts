/**
 * GET /api/reports/audit-summary — Issue #1161
 * Aggregate audit logs by action type.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth";
import { success, error } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try { await requireManager(); } catch { return error("ForbiddenError", "僅限管理員", 403); }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const dateFilter: Record<string, unknown> = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const groups = await prisma.auditLog.groupBy({
    by: ["action"],
    where: Object.keys(dateFilter).length ? { createdAt: dateFilter } : {},
    _count: true,
    orderBy: { _count: { action: "desc" } },
  });

  return success(groups.map((g) => ({ action: g.action, count: g._count })));
}
