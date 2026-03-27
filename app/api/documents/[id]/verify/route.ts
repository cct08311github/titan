import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { NotFoundError } from "@/services/errors";

/**
 * POST /api/documents/{id}/verify — Mark document as verified (Issue #968)
 *
 * Sets verifiedAt to now and optionally assigns verifier + interval.
 * Body (optional): { verifyIntervalDays?: number }
 */
export const POST = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new NotFoundError(`Document not found: ${id}`);

  let verifyIntervalDays: number | undefined;
  try {
    const body = await req.json();
    verifyIntervalDays = body?.verifyIntervalDays;
  } catch {
    // No body is fine — just verify with current settings
  }

  const now = new Date();
  const intervalDays = verifyIntervalDays ?? doc.verifyIntervalDays;
  const verifyByDate = intervalDays
    ? new Date(now.getTime() + intervalDays * 86400000)
    : null;

  const updated = await prisma.document.update({
    where: { id },
    data: {
      verifierId: session.user.id,
      verifiedAt: now,
      ...(verifyIntervalDays !== undefined && { verifyIntervalDays }),
      verifyByDate,
      updatedBy: session.user.id,
    },
    include: {
      creator: { select: { id: true, name: true } },
      updater: { select: { id: true, name: true } },
      verifier: { select: { id: true, name: true } },
    },
  });

  return success(updated);
});
