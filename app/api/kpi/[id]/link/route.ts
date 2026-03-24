import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/services/errors";
import { withManager } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";

export const POST = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {

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
