import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError, ForbiddenError } from "@/services/errors";
import { withAuth } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { validateBody } from "@/lib/validate";
import { createKpiAchievementSchema } from "@/validators/kpi-validators";
import { hasMinimumRole } from "@/lib/auth/permissions";

/**
 * GET /api/kpi/:id/achievement — 取得填報歷史
 */
export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const kpi = await prisma.kPI.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!kpi) throw new NotFoundError("找不到 KPI");

  const achievements = await prisma.kPIAchievement.findMany({
    where: { kpiId: id },
    orderBy: { period: "desc" },
  });

  return success(achievements);
});

/**
 * POST /api/kpi/:id/achievement — 填報 KPI 值
 * 僅負責人（KPI creator）和 Admin 可填報
 * 同一週期重複填報為更新（upsert）
 */
export const POST = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;

  const kpi = await prisma.kPI.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      minValue: true,
      maxValue: true,
      createdBy: true,
    },
  });
  if (!kpi) throw new NotFoundError("找不到 KPI");

  // 僅 ACTIVE 的 KPI 可填報
  if (kpi.status !== "ACTIVE") {
    throw new ValidationError(
      JSON.stringify({
        error: "僅啟用中的 KPI 可以填報",
        fields: {},
      })
    );
  }

  // 權限：KPI 建立者或 Admin 可填報
  const isAdmin = hasMinimumRole(session.user.role, "ADMIN");
  const isCreator = kpi.createdBy === session.user.id;
  if (!isAdmin && !isCreator) {
    throw new ForbiddenError("僅 KPI 負責人或 Admin 可填報");
  }

  const raw = await req.json();
  const { period, actualValue, note } = validateBody(createKpiAchievementSchema, raw);

  // 值域驗證
  if (kpi.minValue != null && actualValue < kpi.minValue) {
    throw new ValidationError(
      JSON.stringify({
        error: `填報值 ${actualValue} 低於最小值 ${kpi.minValue}`,
        fields: { actualValue: [`不可低於 ${kpi.minValue}`] },
      })
    );
  }
  if (kpi.maxValue != null && actualValue > kpi.maxValue) {
    throw new ValidationError(
      JSON.stringify({
        error: `填報值 ${actualValue} 超過最大值 ${kpi.maxValue}`,
        fields: { actualValue: [`不可超過 ${kpi.maxValue}`] },
      })
    );
  }

  // Upsert: 同一 KPI + 同一週期只有一筆（重複填報為更新）
  const achievement = await prisma.kPIAchievement.upsert({
    where: { kpiId_period: { kpiId: id, period } },
    create: {
      kpiId: id,
      period,
      actualValue,
      note: note || null,
      reportedBy: session.user.id,
    },
    update: {
      actualValue,
      note: note || null,
      reportedBy: session.user.id,
    },
  });

  // 更新 KPI 的 actual 值（取所有填報的平均或最新值）
  const allAchievements = await prisma.kPIAchievement.findMany({
    where: { kpiId: id },
    orderBy: { period: "desc" },
  });
  if (allAchievements.length > 0) {
    const latestActual = allAchievements[0].actualValue;
    await prisma.kPI.update({
      where: { id },
      data: { actual: latestActual },
    });
  }

  return success(achievement, 201);
});
