import { NextRequest } from "next/server";
import { withManager } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";
import { AuditService } from "@/services/audit-service";
import { prisma } from "@/lib/prisma";

const auditService = new AuditService(prisma);

/**
 * GET /api/admin/audit-queue
 * Returns audit failure queue status (depth, oldest entry timestamp).
 * MANAGER only.
 */
export const GET = withManager(async (_req: NextRequest) => {
  const status = await auditService.getQueueStatus();
  return success(status);
});

/**
 * POST /api/admin/audit-queue
 * Triggers processing of the audit failure queue (retry failed entries).
 * Returns the number of entries successfully processed.
 * MANAGER only.
 */
export const POST = withManager(async (_req: NextRequest) => {
  const processed = await auditService.processAuditQueue();
  return success({ processed });
});
