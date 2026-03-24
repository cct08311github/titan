import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { UnauthorizedError, ValidationError } from "@/services/errors";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const body = await req.json();
  const { title, type, taskId, kpiId, annualPlanId, monthlyGoalId, attachmentUrl } = body;

  if (!title || !type) {
    throw new ValidationError("標題和類型為必填");
  }

  const deliverable = await prisma.deliverable.create({
    data: {
      title,
      type,
      taskId: taskId || null,
      kpiId: kpiId || null,
      annualPlanId: annualPlanId || null,
      monthlyGoalId: monthlyGoalId || null,
      attachmentUrl: attachmentUrl || null,
    },
  });

  return success(deliverable, 201);
});
