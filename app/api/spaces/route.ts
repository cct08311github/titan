import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validate";
import { createSpaceSchema } from "@/validators/space-validators";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { parsePagination } from "@/lib/pagination";

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);

  const where = {};

  const [spaces, total] = await Promise.all([
    prisma.knowledgeSpace.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true } },
        _count: { select: { documents: true } },
      },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    prisma.knowledgeSpace.count({ where }),
  ]);

  return success({ items: spaces, total, page, limit });
});

export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const raw = await req.json();
  const { name, description } = validateBody(createSpaceSchema, raw);

  const space = await prisma.knowledgeSpace.create({
    data: {
      name,
      description: description ?? null,
      createdBy: session.user.id,
    },
    include: {
      creator: { select: { id: true, name: true } },
      _count: { select: { documents: true } },
    },
  });

  return success(space, 201);
});
