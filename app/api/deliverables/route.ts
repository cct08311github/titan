import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/services/errors";
import { success } from "@/lib/api-response";
import { DeliverableService } from "@/services/deliverable-service";
import { listDeliverablesSchema, createDeliverableSchema } from "@/validators/deliverable-validators";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { parsePagination } from "@/lib/pagination";

export const GET = withAuth(async (req: NextRequest) => {
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
    const flat = query.error.flatten();
    throw new ValidationError(
      JSON.stringify({ error: "輸入驗證失敗", fields: flat.fieldErrors })
    );
  }

  const { page, limit, skip } = parsePagination(searchParams);
  const service = new DeliverableService(prisma);

  const [deliverables, total] = await Promise.all([
    service.listDeliverables(query.data, { skip, take: limit }),
    service.countDeliverables(query.data),
  ]);

  return success({ items: deliverables, total, page, limit });
});

export const POST = withManager(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = createDeliverableSchema.safeParse(body);

  if (!parsed.success) {
    const flat = parsed.error.flatten();
    throw new ValidationError(
      JSON.stringify({ error: "輸入驗證失敗", fields: flat.fieldErrors })
    );
  }

  const service = new DeliverableService(prisma);
  const deliverable = await service.createDeliverable(parsed.data);
  return success(deliverable, 201);
});
