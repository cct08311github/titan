import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const kpi = await prisma.kPI.findUnique({
      where: { id: params.id },
      include: {
        taskLinks: {
          include: {
            task: {
              select: {
                id: true,
                title: true,
                status: true,
                progressPct: true,
                dueDate: true,
                primaryAssignee: { select: { id: true, name: true } },
              },
            },
          },
        },
        deliverables: true,
        creator: { select: { id: true, name: true } },
      },
    });

    if (!kpi) {
      return NextResponse.json({ error: "找不到 KPI" }, { status: 404 });
    }

    return NextResponse.json(kpi);
  } catch (error) {
    console.error("GET /api/kpi/[id] error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

export async function PUT(
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
    const { title, description, target, actual, weight, status, autoCalc } =
      body;

    const kpi = await prisma.kPI.update({
      where: { id: params.id },
      data: {
        ...(title != null && { title }),
        ...(description != null && { description }),
        ...(target != null && { target: parseFloat(target) }),
        ...(actual != null && { actual: parseFloat(actual) }),
        ...(weight != null && { weight: parseFloat(weight) }),
        ...(status != null && { status }),
        ...(autoCalc != null && { autoCalc }),
      },
    });

    return NextResponse.json(kpi);
  } catch (error) {
    console.error("PUT /api/kpi/[id] error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
