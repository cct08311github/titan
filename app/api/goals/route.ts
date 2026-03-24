import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "未授權" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const planId = searchParams.get("planId");
    const month = searchParams.get("month");

    const goals = await prisma.monthlyGoal.findMany({
      where: {
        ...(planId && { annualPlanId: planId }),
        ...(month && { month: parseInt(month) }),
      },
      include: {
        annualPlan: { select: { id: true, title: true, year: true } },
        _count: { select: { tasks: true } },
        deliverables: true,
      },
      orderBy: [{ annualPlanId: "asc" }, { month: "asc" }],
    });

    return NextResponse.json(goals);
  } catch (error) {
    console.error("GET /api/goals error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) return NextResponse.json({ error: "未授權" }, { status: 401 });

    const body = await req.json();
    const { annualPlanId, month, title, description } = body;

    if (!annualPlanId || !month || !title) {
      return NextResponse.json({ error: "計畫ID、月份和標題為必填" }, { status: 400 });
    }

    const goal = await prisma.monthlyGoal.create({
      data: {
        annualPlanId,
        month: parseInt(month),
        title,
        description: description || null,
      },
      include: {
        annualPlan: { select: { id: true, title: true, year: true } },
        tasks: true,
      },
    });

    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    console.error("POST /api/goals error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
