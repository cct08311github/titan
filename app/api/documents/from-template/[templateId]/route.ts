import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { NotFoundError, ValidationError } from "@/services/errors";

/**
 * POST /api/documents/from-template/{templateId} — Create document from template (Issue #1002)
 *
 * Body: { title: string, spaceId?: string, tags?: string[] }
 * Creates a new DRAFT document pre-filled with the template content.
 */
export const POST = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { templateId } = await context.params;

  const template = await prisma.documentTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template) throw new NotFoundError(`Template not found: ${templateId}`);

  const body = await req.json();
  const { title, spaceId, tags } = body;
  if (!title || title.trim().length === 0) {
    throw new ValidationError("title 為必填欄位");
  }

  // Generate slug from title
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "")
    + "-" + Date.now().toString(36);

  const doc = await prisma.document.create({
    data: {
      title,
      content: template.content,
      slug,
      status: "DRAFT",
      tags: tags ?? [],
      createdBy: session.user.id,
      updatedBy: session.user.id,
      ...(spaceId && { spaceId }),
    },
    include: {
      creator: { select: { id: true, name: true } },
      updater: { select: { id: true, name: true } },
    },
  });

  return success(doc, 201);
});
