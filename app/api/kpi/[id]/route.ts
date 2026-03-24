import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { updateKpiSchema } from "@/validators/kpi-validators";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";

export const GET = apiHandler(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

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

export const PUT = apiHandler(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();
  if (session.user.role !== "MANAGER") throw new ForbiddenError();

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
