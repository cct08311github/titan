import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { ValidationError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { createKpiSchema } from "@/validators/kpi-validators";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

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

    return NextResponse.json(kpis);
  } catch (error) {
    console.error("GET /api/kpi error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }
    if (session.user.role !== "MANAGER") {
      return NextResponse.json({ error: "權限不足" }, { status: 403 });
    }

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

    return NextResponse.json(kpi, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/kpi error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
