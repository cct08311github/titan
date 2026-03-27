import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withManager } from "@/lib/auth-middleware";
import { requireMinRole } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { NotFoundError, ValidationError } from "@/services/errors";

/**
 * POST /api/documents/{id}/reject — Reviewer rejects document (Issue #1002)
 *
 * Transitions IN_REVIEW → DRAFT with reason. Requires MANAGER role.
 * Body: { reason: string }
 * Writes AuditLog via apiHandler auto-audit.
 */
export const POST = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireMinRole("MANAGER");
  const { id } = await context.params;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new NotFoundError(`Document not found: ${id}`);
  if (doc.status !== "IN_REVIEW") {
    throw new ValidationError("只有處於審核中的文件才能駁回");
  }

  let reason: string | undefined;
  try {
    const body = await req.json();
    reason = body?.reason;
  } catch {
    // No body provided
  }

  if (!reason || reason.trim().length === 0) {
    throw new ValidationError("駁回必須提供理由");
  }

  const updated = await prisma.document.update({
    where: { id },
    data: {
      status: "DRAFT",
      updatedBy: session.user.id,
    },
    include: {
      creator: { select: { id: true, name: true } },
      updater: { select: { id: true, name: true } },
    },
  });

  // Write explicit audit log for reject action
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "REJECT",
      module: "KNOWLEDGE",
      resourceType: "Document",
      resourceId: id,
      detail: `Rejected document "${doc.title}" (IN_REVIEW → DRAFT): ${reason}`,
      metadata: { reason },
    },
  });

  return success(updated);
});
