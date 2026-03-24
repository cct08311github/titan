import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "未授權" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");

    const plans = await prisma.annualPlan.findMany({
      where: year ? { year: parseInt(year) } : undefined,
      include: {
        creator: { select: { id: true, name: true } },
        milestones: { orderBy: { order: "asc" } },
        monthlyGoals: {
          orderBy: { month: "asc" },
          include: {
            _count: { select: { tasks: true } },
          },
        },
        _count: { select: { monthlyGoals: true } },
      },
      orderBy: { year: "desc" },
    });

    return NextResponse.json(plans);
  } catch (error) {
    console.error("GET /api/plans error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) return NextResponse.json({ error: "未授權" }, { status: 401 });

    const body = await req.json();
    const { year, title, description, implementationPlan, milestones } = body;

    if (!year || !title) {
      return NextResponse.json({ error: "年份和標題為必填" }, { status: 400 });
    }

    const plan = await prisma.annualPlan.create({
      data: {
        year: parseInt(year),
        title,
        description: description || null,
        implementationPlan: implementationPlan || null,
        createdBy: session.user.id,
        milestones: milestones?.length
          ? {
              create: milestones.map(
                (m: { title: string; plannedEnd: string; plannedStart?: string; description?: string; order?: number }, i: number) => ({
                  title: m.title,
                  plannedEnd: new Date(m.plannedEnd),
                  plannedStart: m.plannedStart ? new Date(m.plannedStart) : null,
                  description: m.description || null,
                  order: m.order ?? i,
                })
              ),
            }
          : undefined,
      },
      include: {
        milestones: true,
        monthlyGoals: true,
      },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error("POST /api/plans error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
