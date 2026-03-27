import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { validateBody } from "@/lib/validate";
import { createDocCommentSchema } from "@/validators/knowledge-validators";
import { success } from "@/lib/api-response";
import { NotFoundError } from "@/services/errors";

export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new NotFoundError("文件不存在");

  const comments = await prisma.documentComment.findMany({
    where: { documentId: id, parentId: null },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      replies: {
        include: {
          author: { select: { id: true, name: true, avatar: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return success(comments);
});

export const POST = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;
  const raw = await req.json();
  const body = validateBody(createDocCommentSchema, raw);

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new NotFoundError("文件不存在");

  if (body.parentId) {
    const parent = await prisma.documentComment.findFirst({
      where: { id: body.parentId, documentId: id },
    });
    if (!parent) throw new NotFoundError("父評論不存在");
  }

  const comment = await prisma.documentComment.create({
    data: {
      documentId: id,
      authorId: session.user.id,
      content: body.content,
      parentId: body.parentId ?? null,
    },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
    },
  });

  return success(comment, 201);
});
