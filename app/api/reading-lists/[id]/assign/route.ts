import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { validateBody } from "@/lib/validate";
import { assignReadingListSchema } from "@/validators/reading-list-validators";
import { success } from "@/lib/api-response";
import { NotFoundError, ValidationError } from "@/services/errors";

export const POST = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;
  const raw = await req.json();
  const body = validateBody(assignReadingListSchema, raw);

  const list = await prisma.readingList.findUnique({ where: { id } });
  if (!list) throw new NotFoundError("閱讀清單不存在");

  const user = await prisma.user.findUnique({ where: { id: body.userId } });
  if (!user || !user.isActive) {
    throw new ValidationError("使用者不存在或已停用");
  }

  const existing = await prisma.readingListAssignment.findUnique({
    where: { readingListId_userId: { readingListId: id, userId: body.userId } },
  });
  if (existing) {
    throw new ValidationError("該使用者已被指派此清單");
  }

  const assignment = await prisma.readingListAssignment.create({
    data: {
      readingListId: id,
      userId: body.userId,
      assignedBy: session.user.id,
    },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
      assigner: { select: { id: true, name: true } },
    },
  });

  return success(assignment, 201);
});
