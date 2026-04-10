import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validate";
import { createKpiSchema } from "@/validators/kpi-validators";
import { success, error } from "@/lib/api-response";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { ValidationError } from "@/services/errors";
import { parseYear, parsePage, parseLimit } from "@/lib/query-params";

export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const { searchParams } = new URL(req.url);
  const year = parseYear(searchParams.get("year"));

  // Filters
  const statusFilter = searchParams.get("status");
  const frequencyFilter = searchParams.get("frequency");
  const search = searchParams.get("search");
  const includeLatest = searchParams.get("include") === "latestAchievement";
  const page = parsePage(searchParams.get("page"));
  const limit = parseLimit(searchParams.get("limit"), 100, 500);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { year, deletedAt: null };

  // Visibility: ENGINEER can only see ALL-visible KPIs
  if (session.user.role === "ENGINEER") {
    where.visibility = "ALL";
  }

  if (statusFilter) where.status = statusFilter;
  if (frequencyFilter) where.frequency = frequencyFilter;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }

  const [kpis, total] = await Promise.all([
    prisma.kPI.findMany({
      where,
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
        ...(includeLatest && {
          achievements: {
            orderBy: { createdAt: "desc" as const },
            take: 1,
          },
        }),
      },
      orderBy: { code: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.kPI.count({ where }),
  ]);

  return success({ items: kpis, total, page, limit });
});

export const POST = withManager(async (req: NextRequest) => {
  const session = await requireAuth();

  const raw = await req.json();
  const data = validateBody(
    createKpiSchema,
    { ...raw, year: raw.year ? parseInt(raw.year) : raw.year }
  );

  // Weight total validation: existing KPIs + new one must not exceed 100%
  const existingWeightSum = await prisma.kPI.aggregate({
    where: { year: data.year, status: { not: "CANCELLED" } },
    _sum: { weight: true },
  });
  const currentTotal = existingWeightSum._sum.weight ?? 0;
  const newWeight = data.weight ?? 1;
  if (currentTotal + newWeight > 100) {
    throw new ValidationError(
      JSON.stringify({
        error: `權重合計超過 100%（目前已用 ${currentTotal}%，新增 ${newWeight}%）`,
        fields: { weight: [`權重合計不可超過 100%（目前 ${currentTotal}%）`] },
      })
    );
  }

  const kpi = await prisma.kPI.create({
    data: {
      year: data.year,
      code: data.code,
      title: data.title,
      description: data.description || null,
      measureMethod: data.measureMethod || null,
      target: data.target,
      weight: data.weight ?? 1,
      frequency: data.frequency ?? "MONTHLY",
      minValue: data.minValue ?? null,
      maxValue: data.maxValue ?? null,
      unit: data.unit || null,
      visibility: data.visibility ?? "ALL",
      autoCalc: data.autoCalc ?? false,
      createdBy: session.user.id,
    },
  });

  return success(kpi, 201);
});
