import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validate";
import { changeStatusTransitionSchema } from "@/validators/change-record-validators";
import { success, error } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { getClientIp } from "@/lib/get-client-ip";
import { AuditService } from "@/services/audit-service";
import { NotFoundError, ForbiddenError } from "@/services/errors";
import { isValidTransition, getAllowedTransitions } from "@/lib/change-state-machine";
import type { ChangeStatus } from "@/lib/change-state-machine";

const auditService = new AuditService(prisma);

export const PATCH = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;

  const existing = await prisma.changeRecord.findUnique({
    where: { taskId: id },
  });

  if (!existing) {
    throw new NotFoundError("變更紀錄不存在");
  }

  const raw = await req.json();
  const body = validateBody(changeStatusTransitionSchema, raw);

  const currentStatus = existing.status as ChangeStatus;
  const targetStatus = body.status as ChangeStatus;

  // Validate state transition
  if (!isValidTransition(currentStatus, targetStatus, existing.type)) {
    const allowed = getAllowedTransitions(currentStatus, existing.type);
    return error(
      "ValidationError",
      `不允許從「${currentStatus}」轉移到「${targetStatus}」。允許的目標狀態：${allowed.length > 0 ? allowed.join(", ") : "無（終態）"}`,
      422
    );
  }

  // PENDING_APPROVAL -> APPROVED requires MANAGER role
  if (currentStatus === "PENDING_APPROVAL" && targetStatus === "APPROVED") {
    if (session.user.role !== "MANAGER") {
      throw new ForbiddenError("僅 MANAGER 角色可核准變更");
    }
  }

  // Build update data
  const updateData: Record<string, unknown> = { status: targetStatus };

  // Auto-set timestamps based on transitions
  if (targetStatus === "APPROVED") {
    updateData.cabApprovedBy = session.user.id;
    updateData.cabApprovedAt = new Date();
  }
  if (targetStatus === "IN_PROGRESS" && !existing.actualStart) {
    updateData.actualStart = new Date();
  }
  if (targetStatus === "COMPLETED" || targetStatus === "ROLLED_BACK") {
    updateData.actualEnd = new Date();
  }

  const record = await prisma.changeRecord.update({
    where: { taskId: id },
    data: updateData,
  });

  // Audit log
  await auditService.log({
    userId: session.user.id,
    action: "CHANGE_STATUS_TRANSITION",
    resourceType: "ChangeRecord",
    resourceId: record.id,
    detail: JSON.stringify({
      taskId: id,
      from: currentStatus,
      to: targetStatus,
      note: body.note,
    }),
    ipAddress: getClientIp(req),
  });

  return success(record);
});
