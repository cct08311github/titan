import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { UnauthorizedError, ForbiddenError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { createKpiSchema } from "@/validators/kpi-validators";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year")
    ? parseInt(searchParams.get("year")!)
    : new Date().getFullYear();

  const kpis = await prisma.kPI.findMany({
    where: { year },
    include: {
      taskLinks: {
        include: {
          task: {
            select: {
              id: true,
              title: true,
              status: true,
              progressPct: true,
              primaryAssignee: { select: { id: true, name: true } },
            },
          },
        },
      },
      deliverables: true,
      creator: { select: { id: true, name: true } },
    },
    orderBy: { code: "asc" },
  });

  return success(kpis);
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();
  if (session.user.role !== "MANAGER") throw new ForbiddenError();

  const raw = await req.json();
  const { year, code, title, description, target, weight, autoCalc } = validateBody(
    createKpiSchema,
    { ...raw, year: raw.year ? parseInt(raw.year) : raw.year }
  );

  const kpi = await prisma.kPI.create({
    data: {
      year,
      code,
      title,
      description: description || null,
      target,
      weight: weight ?? 1,
      autoCalc: autoCalc ?? false,
      createdBy: session.user.id,
    },
  });

  return success(kpi, 201);
});
