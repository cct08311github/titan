import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { ValidationError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { updatePlanSchema } from "@/validators/plan-validators";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "未授權" }, { status: 401 });

    const { id } = await params;
    const plan = await prisma.annualPlan.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true } },
        milestones: { orderBy: { order: "asc" } },
        deliverables: true,
        monthlyGoals: {
          orderBy: { month: "asc" },
          include: {
            tasks: {
              include: {
                primaryAssignee: { select: { id: true, name: true, avatar: true } },
                backupAssignee: { select: { id: true, name: true, avatar: true } },
                _count: { select: { subTasks: true } },
              },
            },
            deliverables: true,
          },
        },
      },
    });

    if (!plan) return NextResponse.json({ error: "計畫不存在" }, { status: 404 });
    return NextResponse.json(plan);
  } catch (error) {
    console.error("GET /api/plans/[id] error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) return NextResponse.json({ error: "未授權" }, { status: 401 });

    const { id } = await params;
    const raw = await req.json();
    const { title, description, implementationPlan, progressPct } = validateBody(updatePlanSchema, raw);

    const plan = await prisma.annualPlan.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(implementationPlan !== undefined && { implementationPlan }),
        ...(progressPct !== undefined && { progressPct }),
      },
      include: { milestones: true, monthlyGoals: true },
    });

    return NextResponse.json(plan);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("PUT /api/plans/[id] error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
