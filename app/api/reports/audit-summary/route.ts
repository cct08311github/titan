/**
 * GET /api/reports/audit-summary — Issue #1161
 *
 * Banking compliance audit report:
 * - mode=detail (default): full audit log entries with all fields
 * - mode=summary: aggregate counts by action type
 *
 * Filters: from, to, userId, action, module, resourceType
 * Pagination: limit (default 200, max 5000), offset
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManagerOrAbove as requireManager } from "@/lib/auth";
import { success, error } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { parseLimit, parseOffset } from "@/lib/query-params";

// Issue #1212: wrap with apiHandler for rate limiting and error handling
export const GET = apiHandler(async (req: NextRequest) => {
  try {
    await requireManager();
  } catch {
    return error("ForbiddenError", "僅限管理員", 403);
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "detail";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const userId = searchParams.get("userId");
  const action = searchParams.get("action");
  const module = searchParams.get("module");
  const resourceType = searchParams.get("resourceType");
  const limit = parseLimit(searchParams.get("limit"), 200, 5000);
  const offset = parseOffset(searchParams.get("offset"));

  // Build where clause
  const where: Record<string, unknown> = {};
  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(`${to}T23:59:59.999Z`);
    where.createdAt = dateFilter;
  }
  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (module) where.module = module;
  if (resourceType) where.resourceType = resourceType;

  if (mode === "summary") {
    // Aggregate mode — counts by action
    const groups = await prisma.auditLog.groupBy({
      by: ["action"],
      where,
      _count: true,
      orderBy: { _count: { action: "desc" } },
    });
    const total = await prisma.auditLog.count({ where });
    return success({ summary: groups.map((g) => ({ action: g.action, count: g._count })), total });
  }

  // Detail mode — full entries for compliance
  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: offset }),
    prisma.auditLog.count({ where }),
  ]);

  // Manual join — AuditLog has no Prisma relation to User
  const userIds = [...new Set(entries.filter((e) => e.userId).map((e) => e.userId!))];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, role: true } }) : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  return success({
    entries: entries.map((e) => {
      const u = e.userId ? userMap[e.userId] : null;
      return {
        id: e.id,
        timestamp: e.createdAt.toISOString(),
        user: u ? { id: u.id, name: u.name, email: u.email, role: u.role } : null,
        action: e.action,
        module: e.module,
        resourceType: e.resourceType,
        resourceId: e.resourceId,
        detail: e.detail,
        metadata: e.metadata,
        ipAddress: e.ipAddress,
        userAgent: e.userAgent,
      };
    }),
    total,
    limit,
    offset,
  });
});
