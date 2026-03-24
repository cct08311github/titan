import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { updateKpiSchema } from "@/validators/kpi-validators";
import { success } from "@/lib/api-response";
import { withAuth, withManager } from "@/lib/auth-middleware";

export const GET = withAuth(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {

  const { id } = await context!.params;
  const kpi = await prisma.kPI.findUnique({
    where: { id },
    include: {
      taskLinks: {
        include: {
          task: {
            select: {
              id: true,
              title: true,
              status: true,
              progressPct: true,
              dueDate: true,
              primaryAssignee: { select: { id: true, name: true } },
            },
          },
        },
      },
      deliverables: true,
      creator: { select: { id: true, name: true } },
    },
  });

  if (!kpi) throw new NotFoundError("找不到 KPI");
  return success(kpi);
});

export const PUT = withManager(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context!.params;
  const raw = await req.json();
  const { title, description, target, actual, weight, status, autoCalc } =
    validateBody(updateKpiSchema, raw);

  const kpi = await prisma.kPI.update({
    where: { id },
    data: {
      ...(title != null && { title }),
      ...(description != null && { description }),
      ...(target != null && { target }),
      ...(actual != null && { actual }),
      ...(weight != null && { weight }),
      ...(status != null && { status }),
      ...(autoCalc != null && { autoCalc }),
    },
  });

  return success(kpi);
});
