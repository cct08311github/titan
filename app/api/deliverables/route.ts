import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) return NextResponse.json({ error: "未授權" }, { status: 401 });

    const body = await req.json();
    const { title, type, taskId, kpiId, annualPlanId, monthlyGoalId, attachmentUrl } = body;

    if (!title || !type) {
      return NextResponse.json({ error: "標題和類型為必填" }, { status: 400 });
    }

    const deliverable = await prisma.deliverable.create({
      data: {
        title,
        type,
        taskId: taskId || null,
        kpiId: kpiId || null,
        annualPlanId: annualPlanId || null,
        monthlyGoalId: monthlyGoalId || null,
        attachmentUrl: attachmentUrl || null,
      },
    });

    return NextResponse.json(deliverable, { status: 201 });
  } catch (error) {
    console.error("POST /api/deliverables error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
