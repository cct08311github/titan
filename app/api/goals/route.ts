import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { ValidationError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { createGoalSchema } from "@/validators/plan-validators";

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

    const raw = await req.json();
    const { annualPlanId, month, title, description } = validateBody(createGoalSchema, raw);

    const goal = await prisma.monthlyGoal.create({
      data: {
        annualPlanId,
        month,
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
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/goals error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
