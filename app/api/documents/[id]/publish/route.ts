import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { NotFoundError, ValidationError } from "@/services/errors";

export const POST = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new NotFoundError(`Document not found: ${id}`);
  if (doc.status === "PUBLISHED") {
    throw new ValidationError("文件已處於發布狀態");
  }
  if (doc.status === "ARCHIVED") {
    throw new ValidationError("已歸檔文件無法直接發布，請先解除歸檔");
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

  return success(updated);
});
