import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { DeliverableService } from "@/services/deliverable-service";
import { AuditService } from "@/services/audit-service";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireRole, requireMinRole } from "@/lib/rbac";
import { getClientIp } from "@/lib/get-client-ip";
import { validateBody } from "@/lib/validate";
import { updateDeliverableSchema } from "@/validators/deliverable-validators";

const auditService = new AuditService(prisma);

export const GET = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const service = new DeliverableService(prisma);
  const deliverable = await service.getDeliverable(id);
  return success(deliverable);
});

export const PATCH = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireMinRole("MANAGER");
  const { id } = await context.params;
  const raw = await req.json();
  const body = validateBody(updateDeliverableSchema, raw);

  // Server-side enforcement: acceptedBy/acceptedAt come from session, not client
  const data: Record<string, unknown> = {
    ...(body.status !== undefined && { status: body.status }),
    ...(body.title !== undefined && { title: body.title }),
    ...(body.attachmentUrl !== undefined && { attachmentUrl: body.attachmentUrl }),
  };
  if (body.status === "ACCEPTED") {
    data.acceptedBy = session.user.id;
    data.acceptedAt = new Date();
  } else if (body.status !== undefined) {
    // Reset acceptance when status changes away from ACCEPTED
    data.acceptedBy = null;
    data.acceptedAt = null;
  }

  const deliverable = await prisma.deliverable.update({
    where: { id },
    data,
  });

  return success(deliverable);
});

export const DELETE = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireRole("MANAGER");
  const { id } = await context.params;
  await prisma.deliverable.delete({ where: { id } });

  await auditService.log({
    userId: session.user.id,
    action: "DELETE_DELIVERABLE",
    resourceType: "Deliverable",
    resourceId: id,
    detail: null,
    ipAddress: getClientIp(req),
  });

  return success({ success: true });
});
