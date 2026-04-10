import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/services/errors";
import { withManager } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";
import { sanitizeHtml } from "@/lib/security/sanitize";

export const POST = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {

  const { id } = await context.params;
  const body = await req.json();
  const { taskId, weight, remove } = body;

  if (!taskId) throw new ValidationError("taskId 為必填");

  const safeTaskId = sanitizeHtml(String(taskId));

  if (remove) {
    await prisma.kPITaskLink.deleteMany({ where: { kpiId: id, taskId: safeTaskId } });
    return success({ message: "已移除連結" });
  }

  const parsedWeight = weight != null ? parseFloat(weight) : 1;
  if (!Number.isFinite(parsedWeight) || parsedWeight < 0 || parsedWeight > 100) {
    throw new ValidationError("weight 必須為 0-100 之間的數字");
  }

  const link = await prisma.kPITaskLink.upsert({
    where: { kpiId_taskId: { kpiId: id, taskId: safeTaskId } },
    update: { weight: parsedWeight },
    create: { kpiId: id, taskId: safeTaskId, weight: parsedWeight },
  });

  return success(link, 201);
});
