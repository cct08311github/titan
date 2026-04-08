import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { validateBody } from "@/lib/validate";
import { createDocAttachmentSchema } from "@/validators/knowledge-validators";
import { success, error } from "@/lib/api-response";
import { NotFoundError } from "@/services/errors";

export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new NotFoundError("文件不存在");

  const attachments = await prisma.documentAttachment.findMany({
    where: { documentId: id },
    include: {
      uploader: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return success(attachments);
});

export const POST = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;
  const raw = await req.json();
  const body = validateBody(createDocAttachmentSchema, raw);

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new NotFoundError("文件不存在");

  const attachment = await prisma.documentAttachment.create({
    data: {
      documentId: id,
      fileName: body.fileName,
      fileUrl: body.fileUrl,
      fileSize: body.fileSize,
      mimeType: body.mimeType,
      uploaderId: session.user.id,
    },
    include: {
      uploader: { select: { id: true, name: true } },
    },
  });

  return success(attachment, 201);
});

export const DELETE = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const { searchParams } = new URL(req.url);
  const attachmentId = searchParams.get("attachmentId");

  if (!attachmentId) {
    return error("ValidationError", "attachmentId is required", 400);
  }

  const attachment = await prisma.documentAttachment.findFirst({
    where: { id: attachmentId, documentId: id },
  });
  if (!attachment) throw new NotFoundError("附件不存在");

  await prisma.documentAttachment.delete({ where: { id: attachmentId } });
  return success({ deleted: true });
});
