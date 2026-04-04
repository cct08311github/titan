import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success, error } from "@/lib/api-response";
import { ValidationError } from "@/services/errors";
import { sanitizeMarkdown } from "@/lib/security/sanitize";

/**
 * GET /api/document-templates — List all document templates (Issue #1002)
 *
 * Returns system templates + user-created templates.
 * Query: ?category= to filter by category.
 */
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  const templates = await prisma.documentTemplate.findMany({
    where: {
      ...(category && { category }),
    },
    include: {
      creator: { select: { id: true, name: true } },
    },
    orderBy: [{ isSystem: "desc" }, { createdAt: "desc" }],
  });

  return success(templates);
});

/**
 * POST /api/document-templates — Create a custom document template (Issue #1002)
 *
 * Body: { title: string, content: string, category: string }
 * System templates can only be created via seed.
 */
export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const body = await req.json();

  const { title, content, category } = body;
  if (!title || !content || !category) {
    throw new ValidationError("title, content, category 為必填欄位");
  }

  const cleanTitle = sanitizeMarkdown(title);
  const cleanContent = sanitizeMarkdown(content);
  const cleanCategory = sanitizeMarkdown(category);

  if (!cleanTitle || !cleanContent) {
    return error("VALIDATION_ERROR", "標題和內容不可為空", 400);
  }

  const template = await prisma.documentTemplate.create({
    data: {
      title: cleanTitle,
      content: cleanContent,
      category: cleanCategory,
      isSystem: false,
      createdBy: session.user.id,
    },
    include: {
      creator: { select: { id: true, name: true } },
    },
  });

  return success(template, 201);
});
