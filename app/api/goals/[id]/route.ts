import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { ValidationError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { updateGoalSchema } from "@/validators/plan-validators";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "未授權" }, { status: 401 });

    const { id } = await params;
    const goal = await prisma.monthlyGoal.findUnique({
      where: { id },
      include: {
        annualPlan: { select: { id: true, title: true, year: true } },
        tasks: {
          include: {
            primaryAssignee: { select: { id: true, name: true, avatar: true } },
            backupAssignee: { select: { id: true, name: true, avatar: true } },
            subTasks: true,
            deliverables: true,
          },
          orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
        },
        deliverables: true,
      },
    });

    if (!goal) return NextResponse.json({ error: "目標不存在" }, { status: 404 });
    return NextResponse.json(goal);
  } catch (error) {
    console.error("GET /api/goals/[id] error:", error);
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
    const { title, description, status, progressPct } = validateBody(updateGoalSchema, raw);

    const goal = await prisma.monthlyGoal.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(progressPct !== undefined && { progressPct }),
      },
      include: {
        annualPlan: { select: { id: true, title: true, year: true } },
        tasks: true,
      },
    });

    return NextResponse.json(goal);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("PUT /api/goals/[id] error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
