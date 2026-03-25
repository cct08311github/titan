import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { PlanService } from "@/services/plan-service";
import { validateBody } from "@/lib/validate";
import { createPlanSchema } from "@/validators/plan-validators";
import { success } from "@/lib/api-response";
import { ValidationError } from "@/services/errors";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";

const planService = new PlanService(prisma);

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");

  const plans = await planService.listPlans({
    year: year ? parseInt(year) : undefined,
  });

  return success(plans);
});

export const POST = withManager(async (req: NextRequest) => {
  const session = await requireAuth();

  const raw = await req.json();
  const body = validateBody(createPlanSchema, {
    ...raw,
    year: raw.year ? parseInt(raw.year) : raw.year,
  });
  try {
    const plan = await planService.createPlan({
      ...body,
      createdBy: session.user.id,
    });
    return success(plan, 201);
  } catch (err: unknown) {
    const prismaErr = err as { code?: string; meta?: { target?: string[] } };
    if (prismaErr.code === "P2002" && prismaErr.meta?.target?.includes("year")) {
      throw new ValidationError(`${body.year} 年度計畫已存在，每年僅能建立一份`);
    }
    throw err;
  }
});
