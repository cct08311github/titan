import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { PlanService } from "@/services/plan-service";
import { validateBody } from "@/lib/validate";
import { createPlanSchema } from "@/validators/plan-validators";
import { success } from "@/lib/api-response";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { parseYearOptional } from "@/lib/query-params";
import { parsePagination } from "@/lib/pagination";

const planService = new PlanService(prisma);

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const { page, limit, skip } = parsePagination(searchParams);

  const filter = { year: parseYearOptional(year) };

  const [plans, total] = await Promise.all([
    planService.listPlans(filter, { skip, take: limit }),
    planService.countPlans(filter),
  ]);

  return success({ items: plans, total, page, limit });
});

export const POST = withManager(async (req: NextRequest) => {
  const session = await requireAuth();

  const raw = await req.json();
  const body = validateBody(createPlanSchema, {
    ...raw,
    year: raw.year ? parseInt(raw.year) : raw.year,
  });
  const plan = await planService.createPlan({
    ...body,
    createdBy: session.user.id,
  });
  return success(plan, 201);
});
