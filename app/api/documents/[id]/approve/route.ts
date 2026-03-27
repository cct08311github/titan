import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withManager } from "@/lib/auth-middleware";
import { requireMinRole } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { NotFoundError, ValidationError } from "@/services/errors";

/**
 * POST /api/documents/{id}/approve — Reviewer approves document (Issue #1002)
 *
 * Transitions IN_REVIEW → PUBLISHED. Requires MANAGER role.
 * Writes AuditLog via apiHandler auto-audit.
 */
export const POST = withManager(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireMinRole("MANAGER");
  const { id } = await context.params;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new NotFoundError(`Document not found: ${id}`);
  if (doc.status !== "IN_REVIEW") {
    throw new ValidationError("只有處於審核中的文件才能核准");
  }

  const updated = await prisma.document.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      updatedBy: session.user.id,
    },
    include: {
      creator: { select: { id: true, name: true } },
      updater: { select: { id: true, name: true } },
    },
  });

  // Write explicit audit log for approve action
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "APPROVE",
      module: "KNOWLEDGE",
      resourceType: "Document",
      resourceId: id,
      detail: `Approved document "${doc.title}" (IN_REVIEW → PUBLISHED)`,
    },
  });

  return success(updated);
});
