import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuditService } from "@/services/audit-service";
import { success } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";
import { requireRole } from "@/lib/rbac";

const auditService = new AuditService(prisma);

/**
 * GET /api/audit
 * Returns paginated audit log entries. MANAGER only.
 *
 * Query params:
 *   action        — filter by action string (optional)
 *   userId        — filter by userId (optional)
 *   resourceType  — filter by resourceType (optional)
 *   limit         — max results (optional, default 200)
 */
export const GET = withManager(async (req: NextRequest) => {
  const session = await requireRole("MANAGER");

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");

  const logs = await auditService.queryLogs({
    callerId: session.user.id,
    callerRole: session.user.role,
    action: searchParams.get("action") ?? undefined,
    userId: searchParams.get("userId") ?? undefined,
    resourceType: searchParams.get("resourceType") ?? undefined,
    limit: limitParam ? parseInt(limitParam, 10) : undefined,
  });

  return success(logs);
});
