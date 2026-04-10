import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/services/errors";
import { withManager } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";
import { validateBody } from "@/lib/validate";

const kpiLinkSchema = z.object({
  taskId: z.string().min(1).max(30),
  weight: z.union([z.number(), z.string()]).optional(),
  remove: z.boolean().optional(),
});

export const POST = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {

  const { id } = await context.params;
  const raw = await req.json();
  const { taskId, weight, remove } = validateBody(kpiLinkSchema, raw);

  if (remove) {
    await prisma.kPITaskLink.deleteMany({ where: { kpiId: id, taskId: taskId } });
    return success({ message: "已移除連結" });
  }

  const parsedWeight = weight != null ? parseFloat(String(weight)) : 1;
  if (!Number.isFinite(parsedWeight) || parsedWeight < 0 || parsedWeight > 100) {
    throw new ValidationError("weight 必須為 0-100 之間的數字");
  }

  const link = await prisma.kPITaskLink.upsert({
    where: { kpiId_taskId: { kpiId: id, taskId: taskId } },
    update: { weight: parsedWeight },
    create: { kpiId: id, taskId: taskId, weight: parsedWeight },
  });

  return success(link, 201);
});
