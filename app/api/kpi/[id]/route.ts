import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { updateKpiSchema } from "@/validators/kpi-validators";
import { success } from "@/lib/api-response";
import { withAuth, withManager } from "@/lib/auth-middleware";

export const GET = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {

  const { id } = await context.params;
  const kpi = await prisma.kPI.findUnique({
    where: { id },
    include: {
      taskLinks: {
        include: {
          task: {
            select: {
              id: true,
              title: true,
              status: true,
              progressPct: true,
              dueDate: true,
              primaryAssignee: { select: { id: true, name: true } },
            },
          },
        },
      },
      deliverables: true,
      creator: { select: { id: true, name: true } },
      achievements: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!kpi) throw new NotFoundError("找不到 KPI");
  return success(kpi);
});

export const DELETE = withManager(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const existing = await prisma.kPI.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("找不到 KPI");

  await prisma.$transaction([
    prisma.kPITaskLink.deleteMany({ where: { kpiId: id } }),
    prisma.kPI.delete({ where: { id } }),
  ]);
  return success({ deleted: true });
});

export const PUT = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const raw = await req.json();
  const updates = validateBody(updateKpiSchema, raw);

  const existing = await prisma.kPI.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("找不到 KPI");

  // Status transition: only DRAFT->ACTIVE, ACTIVE->ACHIEVED/MISSED/CANCELLED allowed
  if (updates.status) {
    const validTransitions: Record<string, string[]> = {
      DRAFT: ["ACTIVE"],
      ACTIVE: ["ACHIEVED", "MISSED", "CANCELLED"],
    };
    const allowed = validTransitions[existing.status] || [];
    if (!allowed.includes(updates.status)) {
      throw new ValidationError(
        JSON.stringify({
          error: `無法從 ${existing.status} 轉換為 ${updates.status}`,
          fields: { status: [`不允許的狀態轉換`] },
        })
      );
    }
  }

  // Weight validation: check total won't exceed 100% after update
  if (updates.weight != null && updates.weight !== existing.weight) {
    const otherWeights = await prisma.kPI.aggregate({
      where: {
        year: existing.year,
        status: { not: "CANCELLED" },
        id: { not: id },
      },
      _sum: { weight: true },
    });
    const othersTotal = otherWeights._sum.weight ?? 0;
    if (othersTotal + updates.weight > 100) {
      throw new ValidationError(
        JSON.stringify({
          error: `權重合計超過 100%（其他 KPI 合計 ${othersTotal}%）`,
          fields: { weight: [`權重合計不可超過 100%`] },
        })
      );
    }
  }

  const kpi = await prisma.kPI.update({
    where: { id },
    data: {
      ...(updates.title != null && { title: updates.title }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.measureMethod !== undefined && { measureMethod: updates.measureMethod }),
      ...(updates.target != null && { target: updates.target }),
      ...(updates.actual != null && { actual: updates.actual }),
      ...(updates.weight != null && { weight: updates.weight }),
      ...(updates.frequency != null && { frequency: updates.frequency }),
      ...(updates.minValue !== undefined && { minValue: updates.minValue }),
      ...(updates.maxValue !== undefined && { maxValue: updates.maxValue }),
      ...(updates.unit !== undefined && { unit: updates.unit }),
      ...(updates.visibility != null && { visibility: updates.visibility }),
      ...(updates.status != null && { status: updates.status }),
      ...(updates.autoCalc != null && { autoCalc: updates.autoCalc }),
    },
  });

  return success(kpi);
});
