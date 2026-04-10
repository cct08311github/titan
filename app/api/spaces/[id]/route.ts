import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validate";
import { updateSpaceSchema } from "@/validators/space-validators";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireAuth, requireRole } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { NotFoundError } from "@/services/errors";
import { AuditService } from "@/services/audit-service";
import { getClientIp } from "@/lib/get-client-ip";

const auditService = new AuditService(prisma);

export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const space = await prisma.knowledgeSpace.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true } },
      documents: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          version: true,
          updatedAt: true,
          creator: { select: { id: true, name: true } },
          updater: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
      _count: { select: { documents: true } },
    },
  });
  if (!space) throw new NotFoundError(`Space not found: ${id}`);
  return success(space);
});

export const PUT = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;
  const raw = await req.json();
  const data = validateBody(updateSpaceSchema, raw);

  const existing = await prisma.knowledgeSpace.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`Space not found: ${id}`);

  const space = await prisma.knowledgeSpace.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
    },
    include: {
      creator: { select: { id: true, name: true } },
      _count: { select: { documents: true } },
    },
  });

  return success(space);
});

export const DELETE = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireRole("MANAGER");
  const { id } = await context.params;

  const space = await prisma.knowledgeSpace.findUnique({
    where: { id },
    include: { _count: { select: { documents: true } } },
  });
  if (!space) throw new NotFoundError(`Space not found: ${id}`);

  await prisma.knowledgeSpace.delete({ where: { id } });

  await auditService.log({
    userId: session.user.id,
    action: "DELETE_SPACE",
    resourceType: "KnowledgeSpace",
    resourceId: id,
    detail: null,
    ipAddress: getClientIp(req),
  });

  return success({ success: true });
});
