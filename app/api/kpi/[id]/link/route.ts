import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { UnauthorizedError, ForbiddenError, ValidationError } from "@/services/errors";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";

export const POST = apiHandler(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();
  if (session.user.role !== "MANAGER") throw new ForbiddenError();

  const { id } = await context.params;
  const body = await req.json();
  const { taskId, weight, remove } = body;

  if (!taskId) throw new ValidationError("taskId 為必填");

  if (remove) {
    await prisma.kPITaskLink.deleteMany({ where: { kpiId: id, taskId } });
    return success({ message: "已移除連結" });
  }

  const link = await prisma.kPITaskLink.upsert({
    where: { kpiId_taskId: { kpiId: id, taskId } },
    update: { weight: weight != null ? parseFloat(weight) : 1 },
    create: { kpiId: id, taskId, weight: weight != null ? parseFloat(weight) : 1 },
  });

  return success(link, 201);
});
