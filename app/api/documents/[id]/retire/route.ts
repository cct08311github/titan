import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { NotFoundError, ValidationError } from "@/services/errors";

export const POST = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new NotFoundError(`Document not found: ${id}`);
  if (doc.status === "RETIRED") {
    throw new ValidationError("文件已處於退役狀態");
  }

  const body = await req.json().catch(() => ({}));
  const replacedById = body.replacedById ?? null;

  if (replacedById) {
    const replacement = await prisma.document.findUnique({ where: { id: replacedById } });
    if (!replacement) {
      throw new ValidationError("替代文件不存在");
    }
    if (replacement.id === id) {
      throw new ValidationError("替代文件不可為自身");
    }
  }

  const updated = await prisma.document.update({
    where: { id },
    data: {
      status: "RETIRED",
      replacedById,
      updatedBy: session.user.id,
    },
    include: {
      creator: { select: { id: true, name: true } },
      updater: { select: { id: true, name: true } },
      replacedBy: { select: { id: true, title: true, slug: true } },
    },
  });

  return success(updated);
});
