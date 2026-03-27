import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { validateBody } from "@/lib/validate";
import { addSpaceMemberSchema } from "@/validators/knowledge-validators";
import { success } from "@/lib/api-response";
import { NotFoundError, ValidationError } from "@/services/errors";

export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;

  const space = await prisma.knowledgeSpace.findUnique({ where: { id } });
  if (!space) throw new NotFoundError("知識空間不存在");

  const members = await prisma.spaceMember.findMany({
    where: { spaceId: id },
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return success(members);
});

export const POST = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const raw = await req.json();
  const body = validateBody(addSpaceMemberSchema, raw);

  const space = await prisma.knowledgeSpace.findUnique({ where: { id } });
  if (!space) throw new NotFoundError("知識空間不存在");

  const user = await prisma.user.findUnique({ where: { id: body.userId } });
  if (!user || !user.isActive) {
    throw new ValidationError("使用者不存在或已停用");
  }

  const existing = await prisma.spaceMember.findUnique({
    where: { userId_spaceId: { userId: body.userId, spaceId: id } },
  });
  if (existing) {
    throw new ValidationError("該使用者已是此空間成員");
  }

  const member = await prisma.spaceMember.create({
    data: {
      userId: body.userId,
      spaceId: id,
      role: body.role,
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });

  return success(member, 201);
});
