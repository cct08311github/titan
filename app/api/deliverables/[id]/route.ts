import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { DeliverableService } from "@/services/deliverable-service";
import { withAuth, withManager } from "@/lib/auth-middleware";

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
  const { id } = await context.params;
  const body = await req.json();

  const deliverable = await prisma.deliverable.update({
    where: { id },
    data: {
      ...(body.status !== undefined && { status: body.status }),
      ...(body.title !== undefined && { title: body.title }),
      ...(body.attachmentUrl !== undefined && { attachmentUrl: body.attachmentUrl }),
      ...(body.acceptedBy !== undefined && { acceptedBy: body.acceptedBy }),
      ...(body.acceptedAt !== undefined && { acceptedAt: body.acceptedAt ? new Date(body.acceptedAt) : null }),
    },
  });

  return success(deliverable);
});

export const DELETE = withManager(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  await prisma.deliverable.delete({ where: { id } });
  return success({ success: true });
});
