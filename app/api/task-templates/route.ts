import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validate";
import { createTaskTemplateSchema } from "@/validators/task-template-validators";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { parsePagination, buildPaginationMeta } from "@/lib/pagination";
import { sanitizeMarkdown } from "@/lib/security/sanitize";

/**
 * GET /api/task-templates
 * Lists all task templates with pagination.
 */
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);

  const [templates, total] = await Promise.all([
    prisma.taskTemplate.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        creator: { select: { id: true, name: true } },
      },
    }),
    prisma.taskTemplate.count(),
  ]);

  return success({
    items: templates,
    pagination: buildPaginationMeta(total, { page, limit, skip }),
  });
});

/**
 * POST /api/task-templates
 * Creates a new task template. Any authenticated user can create.
 */
export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const raw = await req.json();
  const body = validateBody(createTaskTemplateSchema, raw);

  const template = await prisma.taskTemplate.create({
    data: {
      ...body,
      title: sanitizeMarkdown(body.title),
      description: body.description !== undefined ? sanitizeMarkdown(body.description) : body.description,
      creatorId: session.user.id,
    },
    include: {
      creator: { select: { id: true, name: true } },
    },
  });

  return success(template, 201);
});
