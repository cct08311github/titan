import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validate";
import { createDocumentSchema } from "@/validators/document-validators";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";

export const GET = withAuth(async () => {
  const docs = await prisma.document.findMany({
    select: {
      id: true,
      parentId: true,
      title: true,
      slug: true,
      version: true,
      createdAt: true,
      updatedAt: true,
      creator: { select: { id: true, name: true } },
      updater: { select: { id: true, name: true } },
      _count: { select: { children: true } },
    },
    orderBy: [{ parentId: "asc" }, { title: "asc" }],
  });

  return success(docs);
});

export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();

  const raw = await req.json();
  const { title, content, parentId } = validateBody(createDocumentSchema, raw);

  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "");
  const timestamp = Date.now();
  const slug = `${base}-${timestamp}`;

  const doc = await prisma.document.create({
    data: {
      parentId: parentId || null,
      title,
      content: content ?? "",
      slug,
      createdBy: session.user.id,
      updatedBy: session.user.id,
      version: 1,
    },
    include: {
      creator: { select: { id: true, name: true } },
      updater: { select: { id: true, name: true } },
    },
  });

  return success(doc, 201);
});
