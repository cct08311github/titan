import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { validateBody } from "@/lib/validate";
import { createReadingListSchema } from "@/validators/reading-list-validators";
import { success } from "@/lib/api-response";
import { parsePagination } from "@/lib/pagination";

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);

  const where = {};

  const [lists, total] = await Promise.all([
    prisma.readingList.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true } },
        _count: { select: { items: true, assignments: true } },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
    prisma.readingList.count({ where }),
  ]);

  return success({ items: lists, total, page, limit });
});

export const POST = withManager(async (req: NextRequest) => {
  const session = await requireAuth();
  const raw = await req.json();
  const body = validateBody(createReadingListSchema, raw);

  const list = await prisma.readingList.create({
    data: {
      title: body.title,
      description: body.description ?? null,
      isDefault: body.isDefault ?? false,
      createdBy: session.user.id,
    },
    include: {
      creator: { select: { id: true, name: true } },
      _count: { select: { items: true, assignments: true } },
    },
  });

  return success(list, 201);
});
