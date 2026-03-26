/**
 * Activity Log API — Issue #802 (AF-1)
 *
 * GET /api/activity — unified activity feed with filtering and RBAC.
 * Merges TaskActivity + AuditLog, sorted by timestamp descending.
 * Append-only: no PUT, PATCH, or DELETE handlers exported.
 *
 * Access: MANAGER sees all; ENGINEER forced to own logs only.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { parsePagination, buildPaginationMeta } from "@/lib/pagination";

interface ActivityItem {
  id: string;
  source: "task_activity" | "audit_log";
  action: string;
  module: string | null;
  userId: string | null;
  userName: string | null;
  resourceType: string;
  resourceId: string | null;
  resourceName: string | null;
  metadata: unknown;
  detail: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);

  // Filters
  const actionFilter = searchParams.get("action") ?? undefined;
  const moduleFilter = searchParams.get("module") ?? undefined;
  const resourceTypeFilter = searchParams.get("resourceType") ?? undefined;

  // ENGINEER can only see own logs
  let userIdFilter = searchParams.get("userId") ?? undefined;
  if (session.user.role === "ENGINEER") {
    userIdFilter = session.user.id;
  }

  // Build where clauses
  const auditWhere: Record<string, unknown> = {};
  if (userIdFilter) auditWhere.userId = userIdFilter;
  if (actionFilter) auditWhere.action = actionFilter;
  if (moduleFilter) auditWhere.module = moduleFilter;
  if (resourceTypeFilter) auditWhere.resourceType = resourceTypeFilter;

  const taskActivityWhere: Record<string, unknown> = {};
  if (userIdFilter) taskActivityWhere.userId = userIdFilter;
  if (actionFilter) taskActivityWhere.action = actionFilter;

  // Fetch both sources in parallel
  const [taskActivities, auditLogs, taskActivityCount, auditLogCount] = await Promise.all([
    prisma.taskActivity.findMany({
      where: taskActivityWhere,
      orderBy: { createdAt: "desc" },
      take: limit * 2,
      skip: 0,
      include: {
        user: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: auditWhere,
      orderBy: { createdAt: "desc" },
      take: limit * 2,
      skip: 0,
    }),
    prisma.taskActivity.count({ where: taskActivityWhere }),
    prisma.auditLog.count({ where: auditWhere }),
  ]);

  // Normalize TaskActivity
  const fromActivities: ActivityItem[] = taskActivities.map((a) => ({
    id: a.id,
    source: "task_activity" as const,
    action: a.action,
    module: "KANBAN",
    userId: a.userId,
    userName: a.user.name,
    resourceType: "Task",
    resourceId: a.taskId,
    resourceName: a.task.title,
    metadata: a.detail,
    detail: a.detail,
    ipAddress: null,
    userAgent: null,
    createdAt: a.createdAt,
  }));

  // Normalize AuditLog (with new Issue #802 fields)
  const fromAuditLogs: ActivityItem[] = auditLogs.map((l) => ({
    id: l.id,
    source: "audit_log" as const,
    action: l.action,
    module: l.module,
    userId: l.userId,
    userName: null,
    resourceType: l.resourceType,
    resourceId: l.resourceId,
    resourceName: null,
    metadata: l.metadata,
    detail: l.detail,
    ipAddress: l.ipAddress,
    userAgent: l.userAgent,
    createdAt: l.createdAt,
  }));

  // Merge and sort by timestamp descending
  const merged = [...fromActivities, ...fromAuditLogs].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  // Manual pagination on merged result
  const total = taskActivityCount + auditLogCount;
  const paginated = merged.slice(skip, skip + limit);

  return success({
    items: paginated,
    total,
    page,
    limit,
    pagination: buildPaginationMeta(total, { page, limit, skip }),
  });
});

// Append-only: no PUT, PATCH, DELETE exported (audit requirement — Issue #802)
