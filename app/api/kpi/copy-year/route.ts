import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { ValidationError } from "@/services/errors";

/**
 * POST /api/kpi/copy-year
 *
 * Copy all KPIs from a source year to a target year.
 * Preserves: code, title, description, target, weight, autoCalc.
 * Resets: actual to 0, status to ACTIVE.
 *
 * Request body:
 *   { sourceYear: number, targetYear: number }
 *
 * Requires MANAGER role.
 */
export const POST = withManager(async (req: NextRequest) => {
  const session = await requireAuth();

  const body = await req.json();
  const sourceYear = typeof body.sourceYear === "string"
    ? parseInt(body.sourceYear, 10)
    : body.sourceYear;
  const targetYear = typeof body.targetYear === "string"
    ? parseInt(body.targetYear, 10)
    : body.targetYear;

  if (!sourceYear || !targetYear || isNaN(sourceYear) || isNaN(targetYear)) {
    throw new ValidationError("sourceYear 和 targetYear 為必填數字欄位");
  }
  if (sourceYear === targetYear) {
    throw new ValidationError("sourceYear 和 targetYear 不可相同");
  }
  if (targetYear < 2000 || targetYear > 2100) {
    throw new ValidationError("targetYear 必須介於 2000–2100");
  }

  // Fetch all KPIs from source year
  const sourceKpis = await prisma.kPI.findMany({
    where: { deletedAt: null, year: sourceYear },
    orderBy: { code: "asc" },
  });

  if (sourceKpis.length === 0) {
    return error("NotFoundError", `來源年度 ${sourceYear} 沒有 KPI 資料`, 404);
  }

  // Idempotency check: if target year already has KPIs, return existing data
  // instead of throwing an error (safe for re-calls)
  const existingKpis = await prisma.kPI.findMany({
    where: { deletedAt: null, year: targetYear },
    orderBy: { code: "asc" },
  });
  if (existingKpis.length > 0) {
    return success(
      {
        sourceYear,
        targetYear,
        copiedCount: existingKpis.length,
        kpis: existingKpis,
        idempotent: true,
      },
      200
    );
  }

  // Copy KPIs to target year — adjust code prefix to target year
  const createdKpis = await prisma.$transaction(
    sourceKpis.map((kpi) => {
      // Replace year in code: KPI-2025-01 → KPI-2026-01
      const newCode = kpi.code.replace(
        String(sourceYear),
        String(targetYear)
      );

      return prisma.kPI.create({
        data: {
          year: targetYear,
          code: newCode,
          title: kpi.title,
          description: kpi.description,
          target: kpi.target,
          actual: 0,
          weight: kpi.weight,
          status: "ACTIVE",
          autoCalc: kpi.autoCalc,
          createdBy: session.user.id,
        },
      });
    })
  );

  return success(
    {
      sourceYear,
      targetYear,
      copiedCount: createdKpis.length,
      kpis: createdKpis,
    },
    201
  );
});
