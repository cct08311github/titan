import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { validateBody } from "@/lib/validate";
import { createCategorySchema } from "@/validators/knowledge-validators";
import { success } from "@/lib/api-response";
import { NotFoundError } from "@/services/errors";

export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;

  const space = await prisma.knowledgeSpace.findUnique({ where: { id } });
  if (!space) throw new NotFoundError("知識空間不存在");

  const categories = await prisma.knowledgeCategory.findMany({
    where: { spaceId: id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return success(categories);
});

export const POST = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const raw = await req.json();
  const body = validateBody(createCategorySchema, raw);

  const space = await prisma.knowledgeSpace.findUnique({ where: { id } });
  if (!space) throw new NotFoundError("知識空間不存在");

  const category = await prisma.knowledgeCategory.create({
    data: {
      spaceId: id,
      name: body.name,
      slug: body.slug,
      parentId: body.parentId ?? null,
      sortOrder: body.sortOrder ?? 0,
    },
  });

  return success(category, 201);
});
