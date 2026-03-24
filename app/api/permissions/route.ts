import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { UnauthorizedError, ForbiddenError, ValidationError } from "@/services/errors";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();
  if (session.user.role !== "MANAGER") throw new ForbiddenError();

  const permissions = await prisma.permission.findMany({
    include: {
      grantee: { select: { id: true, name: true, email: true, role: true } },
      granter: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return success(permissions);
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();
  if (session.user.role !== "MANAGER") throw new ForbiddenError();

  const body = await req.json();
  const { granteeId, permType, targetId, expiresAt, revoke } = body;

  if (!granteeId || !permType) {
    throw new ValidationError("缺少必填欄位");
  }

  if (revoke) {
    await prisma.permission.updateMany({
      where: { granteeId, permType, targetId: targetId || null },
      data: { isActive: false },
    });
    return success({ message: "已撤銷授權" });
  }

  const permission = await prisma.permission.create({
    data: {
      granteeId,
      granterId: session.user.id,
      permType,
      targetId: targetId || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: true,
    },
  });

  return success(permission, 201);
});
