import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validate";
import { createMilestoneSchema } from "@/validators/milestone-validators";
import { MilestoneService } from "@/services/milestone-service";
import { withAuth } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";

const getService = () => new MilestoneService(prisma);

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const planId = searchParams.get("planId") ?? undefined;

  const milestones = await getService().listMilestones({ planId });

  return success(milestones);
});

export const POST = withAuth(async (req: NextRequest) => {

  const raw = await req.json();
  const data = validateBody(createMilestoneSchema, raw);

  const milestone = await getService().createMilestone({
    annualPlanId: data.annualPlanId,
    title: data.title,
    description: data.description,
    plannedStart: data.plannedStart,
    plannedEnd: data.plannedEnd,
    order: data.order,
  });

  return success(milestone, 201);
});
