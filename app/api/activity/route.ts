import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { parsePagination, buildPaginationMeta } from "@/lib/pagination";

interface ActivityItem {
  id: string;
  source: "task_activity" | "audit_log";
  action: string;
  userId: string | null;
  userName: string | null;
  resourceType: string;
  resourceId: string | null;
  resourceName: string | null;
  detail: unknown;
  createdAt: Date;
}

/**
 * GET /api/activity
 * Returns a merged, paginated feed of TaskActivity + AuditLog entries,
 * sorted by timestamp descending.
 */
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);

  // Fetch both sources in parallel
  const [taskActivities, auditLogs, taskActivityCount, auditLogCount] = await Promise.all([
    prisma.taskActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: limit * 2, // over-fetch to merge
      skip: 0,
      include: {
        user: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit * 2,
      skip: 0,
    }),
    prisma.taskActivity.count(),
    prisma.auditLog.count(),
  ]);

  // Normalize TaskActivity
  const fromActivities: ActivityItem[] = taskActivities.map((a) => ({
    id: a.id,
    source: "task_activity" as const,
    action: a.action,
    userId: a.userId,
    userName: a.user.name,
    resourceType: "Task",
    resourceId: a.taskId,
    resourceName: a.task.title,
    detail: a.detail,
    createdAt: a.createdAt,
  }));

  // Normalize AuditLog
  const fromAuditLogs: ActivityItem[] = auditLogs.map((l) => ({
    id: l.id,
    source: "audit_log" as const,
    action: l.action,
    userId: l.userId,
    userName: null, // AuditLog does not join user
    resourceType: l.resourceType,
    resourceId: l.resourceId,
    resourceName: null,
    detail: l.detail,
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
    pagination: buildPaginationMeta(total, { page, limit, skip }),
  });
});
