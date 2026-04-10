import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withManager } from "@/lib/auth-middleware";
import { requireMinRole } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { ValidationError, NotFoundError } from "@/services/errors";
import { sanitizeHtml } from "@/lib/security/sanitize";

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

  let rawReason: unknown;
  try {
    const body = await req.json();
    rawReason = body?.reason;
  } catch {
    // No body provided
  }

  if (!rawReason || typeof rawReason !== "string" || rawReason.trim().length === 0) {
    throw new ValidationError("駁回必須提供理由");
  }
  const reason = sanitizeHtml(rawReason.trim().slice(0, 1000));
  if (!reason) {
    throw new ValidationError("駁回理由不可為空");
  }

  let updated;
  let docTitle: string;
  try {
    // Atomic: only matches when status is still IN_REVIEW
    updated = await prisma.document.update({
      where: { id, status: "IN_REVIEW" },
      data: {
        status: "DRAFT",
        updatedBy: session.user.id,
      },
      include: {
        creator: { select: { id: true, name: true } },
        updater: { select: { id: true, name: true } },
      },
    });
    docTitle = updated.title;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      // Disambiguate: not found vs status mismatch (no race risk after failed update)
      const exists = await prisma.document.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new NotFoundError("文件不存在");
      throw new ValidationError("只有處於審核中的文件才能駁回");
    }
    throw err;
  }

  // Write explicit audit log for reject action
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "REJECT",
      module: "KNOWLEDGE",
      resourceType: "Document",
      resourceId: id,
      detail: `Rejected document "${docTitle}" (IN_REVIEW → DRAFT): ${reason}`,
      metadata: { reason },
    },
  });

  return success(updated);
});
