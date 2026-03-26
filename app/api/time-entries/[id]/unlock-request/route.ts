/**
 * POST /api/time-entries/[id]/unlock-request — Issue #815 (T-6)
 *
 * Allows any authenticated user to request unlock of a locked time entry.
 * Creates an ApprovalRequest record. Manager/Admin can approve via
 * PATCH /api/approvals or POST /api/time-entries/[id]/review.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ForbiddenError, ValidationError } from "@/services/errors";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { validateBody } from "@/lib/validate";
import { success, error } from "@/lib/api-response";

const unlockRequestSchema = z.object({
  reason: z.string().min(1, "請說明修改原因").max(1000),
});

export const POST = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;

  // Verify time entry exists
  const entry = await prisma.timeEntry.findUnique({ where: { id } });
  if (!entry) throw new NotFoundError(`TimeEntry not found: ${id}`);

  // Only the owner can request unlock
  if (entry.userId !== session.user.id) {
    throw new ForbiddenError("只有紀錄擁有者可以申請解鎖");
  }

  // Check if entry is actually locked (manual or auto)
  const entryDate = new Date(entry.date);
  const daysSince = (Date.now() - entryDate.getTime()) / (1000 * 60 * 60 * 24);
  const isLocked = daysSince > 7 || entry.locked === true;

  if (!isLocked) {
    throw new ValidationError("此紀錄尚未鎖定，不需要申請解鎖");
  }

  // Check for existing pending unlock request
  const existingRequest = await prisma.approvalRequest.findFirst({
    where: {
      resourceType: "TimeEntry",
      resourceId: id,
      status: "PENDING",
    },
  });

  if (existingRequest) {
    return error("ConflictError", "已有待審核的解鎖申請", 409);
  }

  const raw = await req.json();
  const { reason } = validateBody(unlockRequestSchema, raw);

  // Create approval request
  const request = await prisma.approvalRequest.create({
    data: {
      requesterId: session.user.id,
      type: "TASK_STATUS_CHANGE", // Reuse existing type; semantically it's an unlock
      resourceId: id,
      resourceType: "TimeEntry",
      reason,
    },
    include: {
      requester: { select: { id: true, name: true, email: true } },
    },
  });

  // Audit trail
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "REQUEST_UNLOCK_TIME_ENTRY",
      module: "TIMESHEET",
      resourceType: "TimeEntry",
      resourceId: id,
      detail: JSON.stringify({ reason, approvalRequestId: request.id }),
    },
  });

  return success(request, 201);
});
