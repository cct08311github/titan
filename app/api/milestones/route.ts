import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validate";
import { createMilestoneSchema } from "@/validators/milestone-validators";
import { MilestoneService } from "@/services/milestone-service";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";
import { parsePagination } from "@/lib/pagination";

const getService = () => new MilestoneService(prisma);

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const planId = searchParams.get("planId") ?? undefined;
  const { page, limit, skip } = parsePagination(searchParams);

  const filter = { planId };
  const svc = getService();

  const [milestones, total] = await Promise.all([
    svc.listMilestones(filter, { skip, take: limit }),
    svc.countMilestones(filter),
  ]);

  return success({ items: milestones, total, page, limit });
});

export const POST = withManager(async (req: NextRequest) => {

  const raw = await req.json();
  const data = validateBody(createMilestoneSchema, raw);

  const milestone = await getService().createMilestone({
    annualPlanId: data.annualPlanId,
    title: data.title,
    description: data.description,
    type: data.type,
    plannedStart: data.plannedStart,
    plannedEnd: data.plannedEnd,
    order: data.order,
  });

  return success(milestone, 201);
});
