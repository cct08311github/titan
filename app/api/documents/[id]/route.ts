import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/services/errors";
import { AuditService } from "@/services/audit-service";
import { validateBody } from "@/lib/validate";
import { updateDocumentSchema } from "@/validators/document-validators";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireAuth, requireRole } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { getClientIp } from "@/lib/get-client-ip";

const auditService = new AuditService(prisma);

export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true } },
      updater: { select: { id: true, name: true } },
      children: {
        select: { id: true, title: true, slug: true },
        orderBy: { title: "asc" },
      },
    },
  });

  if (!doc) throw new NotFoundError("文件不存在");
  return success(doc);
});

export const PUT = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();

  const { id } = await context.params;
  const raw = await req.json();
  const { title, content, parentId } = validateBody(updateDocumentSchema, raw);

  const existing = await prisma.document.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("文件不存在");

  const contentChanged = content !== undefined && content !== existing.content;

  if (contentChanged) {
    await prisma.documentVersion.create({
      data: {
        documentId: id,
        content: existing.content,
        version: existing.version,
        createdBy: session.user.id,
      },
    });
  }

  const updates: Record<string, unknown> = { updatedBy: session.user.id };
  if (title !== undefined) updates.title = title;
  if (contentChanged) {
    updates.content = content;
    updates.version = existing.version + 1;
  }
  if (parentId !== undefined) updates.parentId = parentId || null;

  const doc = await prisma.document.update({
    where: { id },
    data: updates,
    include: {
      creator: { select: { id: true, name: true } },
      updater: { select: { id: true, name: true } },
    },
  });

  return success(doc);
});

export const DELETE = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireRole("MANAGER");
  const { id } = await context.params;
  await prisma.document.delete({ where: { id } });

  await auditService.log({
    userId: session.user.id,
    action: "DELETE_DOCUMENT",
    resourceType: "Document",
    resourceId: id,
    detail: null,
    ipAddress: getClientIp(req),
  });

  return success({ success: true });
});
