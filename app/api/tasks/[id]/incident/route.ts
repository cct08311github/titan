import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validate";
import {
  createIncidentRecordSchema,
  updateIncidentRecordSchema,
} from "@/validators/incident-validators";
import { success, error } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { getClientIp } from "@/lib/get-client-ip";
import { AuditService } from "@/services/audit-service";
import { NotFoundError, ValidationError } from "@/services/errors";

const auditService = new AuditService(prisma);

/**
 * Calculate MTTR in minutes between two dates.
 */
function calcMttrMinutes(start: Date, end: Date | null): number | null {
  if (!end) return null;
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;

  const record = await prisma.incidentRecord.findUnique({
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

  // Verify task exists and is INCIDENT category
  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, category: true },
  });

  if (!task) {
    throw new NotFoundError("任務不存在");
  }

  if (task.category !== "INCIDENT") {
    throw new ValidationError(
      JSON.stringify({
        error: "僅 INCIDENT 類型任務可建立事件管理紀錄",
        fields: {},
      })
    );
  }

  // Check if already exists
  const existing = await prisma.incidentRecord.findUnique({
    where: { taskId: id },
  });
  if (existing) {
    throw new ValidationError(
      JSON.stringify({
        error: "此任務已有事件管理紀錄，請使用 PATCH 更新",
        fields: {},
      })
    );
  }

  const raw = await req.json();
  const body = validateBody(createIncidentRecordSchema, raw);

  const incidentStart = new Date(body.incidentStart);
  const incidentEnd = body.incidentEnd ? new Date(body.incidentEnd) : null;

  const record = await prisma.incidentRecord.create({
    data: {
      taskId: id,
      severity: body.severity,
      impactScope: body.impactScope,
      incidentStart,
      incidentEnd,
      rootCause: body.rootCause ?? null,
      resolution: body.resolution ?? null,
      mttrMinutes: calcMttrMinutes(incidentStart, incidentEnd),
      reportedBy: body.reportedBy ?? null,
    },
  });

  // Audit log
  await auditService.log({
    userId: session.user.id,
    action: "CREATE_INCIDENT_RECORD",
    resourceType: "IncidentRecord",
    resourceId: record.id,
    detail: JSON.stringify({ taskId: id, severity: body.severity }),
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

  const existing = await prisma.incidentRecord.findUnique({
    where: { taskId: id },
  });

  if (!existing) {
    throw new NotFoundError("事件管理紀錄不存在");
  }

  const raw = await req.json();
  const body = validateBody(updateIncidentRecordSchema, raw);

  const incidentStart = body.incidentStart
    ? new Date(body.incidentStart)
    : existing.incidentStart;
  const incidentEnd = body.incidentEnd !== undefined
    ? (body.incidentEnd ? new Date(body.incidentEnd) : null)
    : existing.incidentEnd;

  const record = await prisma.incidentRecord.update({
    where: { taskId: id },
    data: {
      ...(body.severity !== undefined && { severity: body.severity }),
      ...(body.impactScope !== undefined && { impactScope: body.impactScope }),
      ...(body.incidentStart !== undefined && { incidentStart }),
      ...(body.incidentEnd !== undefined && { incidentEnd }),
      ...(body.rootCause !== undefined && { rootCause: body.rootCause ?? null }),
      ...(body.resolution !== undefined && { resolution: body.resolution ?? null }),
      ...(body.reportedBy !== undefined && { reportedBy: body.reportedBy ?? null }),
      mttrMinutes: calcMttrMinutes(incidentStart, incidentEnd),
    },
  });

  // Audit log
  await auditService.log({
    userId: session.user.id,
    action: "UPDATE_INCIDENT_RECORD",
    resourceType: "IncidentRecord",
    resourceId: record.id,
    detail: JSON.stringify({ taskId: id, changes: Object.keys(body) }),
    ipAddress: getClientIp(req),
  });

  return success(record);
});
