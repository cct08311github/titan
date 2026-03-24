import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { PlanService } from "@/services/plan-service";
import { validateBody } from "@/lib/validate";
import { copyTemplateSchema } from "@/validators/plan-validators";
import { success } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";

const planService = new PlanService(prisma);

export const POST = withManager(async (req: NextRequest) => {
  const session = await requireAuth();

  const raw = await req.json();
  const body = validateBody(copyTemplateSchema, {
    ...raw,
    targetYear: raw.targetYear ? parseInt(raw.targetYear) : raw.targetYear,
  });

  const plan = await planService.copyTemplate(
    body.sourcePlanId,
    body.targetYear,
    session.user.id
  );

  return success(plan, 201);
});
