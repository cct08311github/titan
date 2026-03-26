import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validate";
import { createSpaceSchema } from "@/validators/space-validators";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";

export const GET = withAuth(async (_req: NextRequest) => {
  const spaces = await prisma.knowledgeSpace.findMany({
    include: {
      creator: { select: { id: true, name: true } },
      _count: { select: { documents: true } },
    },
    orderBy: { name: "asc" },
  });

  return success({ items: spaces });
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
