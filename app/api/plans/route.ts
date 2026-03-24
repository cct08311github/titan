import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { PlanService } from "@/services/plan-service";
import { ValidationError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { createPlanSchema } from "@/validators/plan-validators";

const planService = new PlanService(prisma);

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "未授權" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");

    const plans = await planService.listPlans({
      year: year ? parseInt(year) : undefined,
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

    const raw = await req.json();
    const body = validateBody(createPlanSchema, {
      ...raw,
      year: raw.year ? parseInt(raw.year) : raw.year,
    });
    const plan = await planService.createPlan({
      ...body,
      createdBy: session.user.id,
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/plans error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
