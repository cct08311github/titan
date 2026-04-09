import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withManager } from "@/lib/auth-middleware";
import { requireMinRole } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { ValidationError, NotFoundError } from "@/services/errors";

/**
 * POST /api/documents/{id}/approve — Reviewer approves document (Issue #1002)
 *
 * Transitions IN_REVIEW → PUBLISHED. Requires MANAGER role.
 * Writes AuditLog via apiHandler auto-audit.
 *
 * The status guard is placed in the WHERE clause so the check-then-update
 * is atomic — prevents double-approval under concurrent requests.
 */
export const POST = withManager(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireMinRole("MANAGER");
  const { id } = await context.params;

  let updated;
  let docTitle: string;
  try {
    // Atomic: only matches when status is still IN_REVIEW
    updated = await prisma.document.update({
      where: { id, status: "IN_REVIEW" },
      data: {
        status: "PUBLISHED",
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
      // P2025 = no record matched WHERE. Could be: doc doesn't exist OR status mismatch.
      // Disambiguate by a follow-up findUnique (no race risk; we already failed to update).
      const exists = await prisma.document.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new NotFoundError("文件不存在");
      throw new ValidationError("只有處於審核中的文件才能核准");
    }
    throw err;
  }

  // Write explicit audit log for approve action
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "APPROVE",
      module: "KNOWLEDGE",
      resourceType: "Document",
      resourceId: id,
      detail: `Approved document "${docTitle}" (IN_REVIEW → PUBLISHED)`,
    },
  });

  return success(updated);
});
