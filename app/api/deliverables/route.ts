import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { UnauthorizedError, ValidationError } from "@/services/errors";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";
import { DeliverableService } from "@/services/deliverable-service";
import { listDeliverablesSchema, createDeliverableSchema } from "@/validators/deliverable-validators";

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const { searchParams } = new URL(req.url);
  const query = listDeliverablesSchema.safeParse({
    taskId: searchParams.get("taskId") ?? undefined,
    kpiId: searchParams.get("kpiId") ?? undefined,
    annualPlanId: searchParams.get("annualPlanId") ?? undefined,
    monthlyGoalId: searchParams.get("monthlyGoalId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    type: searchParams.get("type") ?? undefined,
  });

  if (!query.success) {
    throw new ValidationError(query.error.issues.map((e) => e.message).join(", "));
  }

  const service = new DeliverableService(prisma);
  const deliverables = await service.listDeliverables(query.data);
  return success(deliverables);
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const body = await req.json();
  const parsed = createDeliverableSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((e) => e.message).join(", "));
  }

  const service = new DeliverableService(prisma);
  const deliverable = await service.createDeliverable(parsed.data);
  return success(deliverable, 201);
});
