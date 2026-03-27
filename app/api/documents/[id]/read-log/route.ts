import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { NotFoundError } from "@/services/errors";

export const POST = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new NotFoundError("文件不存在");

  const log = await prisma.documentReadLog.create({
    data: {
      documentId: id,
      userId: session.user.id,
    },
  });

  return success(log, 201);
});
