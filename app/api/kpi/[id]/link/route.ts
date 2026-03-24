import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }
    if (session.user.role !== "MANAGER") {
      return NextResponse.json({ error: "權限不足" }, { status: 403 });
    }

    const body = await req.json();
    const { taskId, weight, remove } = body;

    if (!taskId) {
      return NextResponse.json({ error: "taskId 為必填" }, { status: 400 });
    }

    if (remove) {
      await prisma.kPITaskLink.deleteMany({
        where: { kpiId: params.id, taskId },
      });
      return NextResponse.json({ message: "已移除連結" });
    }

    const link = await prisma.kPITaskLink.upsert({
      where: { kpiId_taskId: { kpiId: params.id, taskId } },
      update: { weight: weight != null ? parseFloat(weight) : 1 },
      create: {
        kpiId: params.id,
        taskId,
        weight: weight != null ? parseFloat(weight) : 1,
      },
    });

    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    console.error("POST /api/kpi/[id]/link error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
