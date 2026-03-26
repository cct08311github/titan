import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validate";
import {
  createChangeRecordSchema,
  updateChangeRecordSchema,
} from "@/validators/change-record-validators";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { getClientIp } from "@/lib/get-client-ip";
import { AuditService } from "@/services/audit-service";
import { NotFoundError, ValidationError } from "@/services/errors";
import { generateChangeNumber } from "@/lib/change-number";

const auditService = new AuditService(prisma);

export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;

  const record = await prisma.changeRecord.findUnique({
    where: { taskId: id },
  });

  return success(record);
});

export const POST = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;

  // Verify task exists
  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!task) {
    throw new NotFoundError("任務不存在");
  }

  // Check if already exists
  const existing = await prisma.changeRecord.findUnique({
    where: { taskId: id },
  });
  if (existing) {
    throw new ValidationError(
      JSON.stringify({
        error: "此任務已有變更紀錄，請使用 PATCH 更新",
        fields: {},
      })
    );
  }

  const raw = await req.json();
  const body = validateBody(createChangeRecordSchema, raw);

  const changeNumber = await generateChangeNumber(prisma);

  const record = await prisma.changeRecord.create({
    data: {
      taskId: id,
      changeNumber,
      type: body.type,
      riskLevel: body.riskLevel,
      impactedSystems: body.impactedSystems,
      scheduledStart: body.scheduledStart ? new Date(body.scheduledStart) : null,
      scheduledEnd: body.scheduledEnd ? new Date(body.scheduledEnd) : null,
      rollbackPlan: body.rollbackPlan ?? null,
      verificationPlan: body.verificationPlan ?? null,
    },
  });

  // Create scheduled notifications if scheduledStart is set
  if (record.scheduledStart) {
    const start = new Date(record.scheduledStart);
    const now = new Date();
    const notify24h = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    const notify2h = new Date(start.getTime() - 2 * 60 * 60 * 1000);

    const notifications = [];
    if (notify24h > now) {
      notifications.push({
        userId: session.user.id,
        type: "TASK_DUE_SOON" as const,
        title: `變更排程提醒：${changeNumber}（24 小時前）`,
        body: `變更 ${changeNumber} 預定於 ${start.toISOString()} 開始執行`,
        relatedId: id,
        relatedType: "ChangeRecord",
      });
    }
    if (notify2h > now) {
      notifications.push({
        userId: session.user.id,
        type: "TASK_DUE_SOON" as const,
        title: `變更排程提醒：${changeNumber}（2 小時前）`,
        body: `變更 ${changeNumber} 預定於 ${start.toISOString()} 開始執行`,
        relatedId: id,
        relatedType: "ChangeRecord",
      });
    }
    if (notifications.length > 0) {
      await prisma.notification.createMany({ data: notifications });
    }
  }

  // Audit log
  await auditService.log({
    userId: session.user.id,
    action: "CREATE_CHANGE_RECORD",
    resourceType: "ChangeRecord",
    resourceId: record.id,
    detail: JSON.stringify({ taskId: id, changeNumber, type: body.type }),
    ipAddress: getClientIp(req),
  });

  return success(record, 201);
});

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
  const body = validateBody(updateChangeRecordSchema, raw);

  const record = await prisma.changeRecord.update({
    where: { taskId: id },
    data: {
      ...(body.type !== undefined && { type: body.type }),
      ...(body.riskLevel !== undefined && { riskLevel: body.riskLevel }),
      ...(body.impactedSystems !== undefined && { impactedSystems: body.impactedSystems }),
      ...(body.scheduledStart !== undefined && {
        scheduledStart: body.scheduledStart ? new Date(body.scheduledStart) : null,
      }),
      ...(body.scheduledEnd !== undefined && {
        scheduledEnd: body.scheduledEnd ? new Date(body.scheduledEnd) : null,
      }),
      ...(body.actualStart !== undefined && {
        actualStart: body.actualStart ? new Date(body.actualStart) : null,
      }),
      ...(body.actualEnd !== undefined && {
        actualEnd: body.actualEnd ? new Date(body.actualEnd) : null,
      }),
      ...(body.rollbackPlan !== undefined && { rollbackPlan: body.rollbackPlan }),
      ...(body.verificationPlan !== undefined && { verificationPlan: body.verificationPlan }),
      ...(body.cabApprovedBy !== undefined && { cabApprovedBy: body.cabApprovedBy }),
      ...(body.cabApprovedAt !== undefined && {
        cabApprovedAt: body.cabApprovedAt ? new Date(body.cabApprovedAt) : null,
      }),
    },
  });

  // Audit log
  await auditService.log({
    userId: session.user.id,
    action: "UPDATE_CHANGE_RECORD",
    resourceType: "ChangeRecord",
    resourceId: record.id,
    detail: JSON.stringify({ taskId: id, changes: Object.keys(body) }),
    ipAddress: getClientIp(req),
  });

  return success(record);
});
