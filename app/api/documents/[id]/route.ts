import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { DocumentService } from "@/services/document-service";
import { AuditService } from "@/services/audit-service";
import { validateBody } from "@/lib/validate";
import { updateDocumentSchema } from "@/validators/document-validators";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireAuth, requireRole } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { getClientIp } from "@/lib/get-client-ip";

const documentService = new DocumentService(prisma);
const auditService = new AuditService(prisma);

export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const doc = await documentService.getDocument(id);
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

  const doc = await documentService.updateDocument(id, {
    title,
    content,
    parentId: parentId !== undefined ? (parentId || null) : undefined,
    updatedBy: session.user.id,
  });

  return success(doc);
});

export const DELETE = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireRole("MANAGER");
  const { id } = await context.params;
  await documentService.deleteDocument(id);

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
