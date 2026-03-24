import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { UnauthorizedError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { updateMilestoneSchema } from "@/validators/milestone-validators";
import { MilestoneService } from "@/services/milestone-service";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";

const getService = () => new MilestoneService(prisma);

export const GET = apiHandler(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session) throw new UnauthorizedError();

  const { id } = await context!.params;
  const milestone = await getService().getMilestone(id);

  return success(milestone);
});

export const PUT = apiHandler(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const { id } = await context!.params;
  const raw = await req.json();
  const data = validateBody(updateMilestoneSchema, raw);

  const milestone = await getService().updateMilestone(id, {
    title: data.title,
    description: data.description,
    plannedStart: data.plannedStart,
    plannedEnd: data.plannedEnd,
    actualStart: data.actualStart,
    actualEnd: data.actualEnd,
    status: data.status,
    order: data.order,
  });

  return success(milestone);
});

export const DELETE = apiHandler(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const { id } = await context!.params;
  await getService().deleteMilestone(id);

  return success({ id });
});
