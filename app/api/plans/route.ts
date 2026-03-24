import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { PlanService } from "@/services/plan-service";
import { UnauthorizedError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { createPlanSchema } from "@/validators/plan-validators";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";

const planService = new PlanService(prisma);

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getServerSession();
  if (!session) throw new UnauthorizedError();

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");

  const plans = await planService.listPlans({
    year: year ? parseInt(year) : undefined,
  });

  return success(plans);
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

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
