import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validate";
import { updateMilestoneSchema } from "@/validators/milestone-validators";
import { MilestoneService } from "@/services/milestone-service";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";

const getService = () => new MilestoneService(prisma);

export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const milestone = await getService().getMilestone(id);

  return success(milestone);
});

export const PUT = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const raw = await req.json();
  const data = validateBody(updateMilestoneSchema, raw);

  const milestone = await getService().updateMilestone(id, {
    title: data.title,
    description: data.description,
    type: data.type,
    plannedStart: data.plannedStart,
    plannedEnd: data.plannedEnd,
    actualStart: data.actualStart,
    actualEnd: data.actualEnd,
    status: data.status,
    order: data.order,
  });

  return success(milestone);
});

export const DELETE = withManager(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  await getService().deleteMilestone(id);

  return success({ id });
});
