import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }
    if (session.user.role !== "MANAGER") {
      return NextResponse.json({ error: "權限不足" }, { status: 403 });
    }

    const permissions = await prisma.permission.findMany({
      include: {
        grantee: { select: { id: true, name: true, email: true, role: true } },
        granter: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(permissions);
  } catch (error) {
    console.error("GET /api/permissions error:", error);
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

    const body = await req.json();
    const { granteeId, permType, targetId, expiresAt, revoke } = body;

    if (!granteeId || !permType) {
      return NextResponse.json({ error: "缺少必填欄位" }, { status: 400 });
    }

    if (revoke) {
      await prisma.permission.updateMany({
        where: { granteeId, permType, targetId: targetId || null },
        data: { isActive: false },
      });
      return NextResponse.json({ message: "已撤銷授權" });
    }

    const permission = await prisma.permission.create({
      data: {
        granteeId,
        granterId: session.user.id,
        permType,
        targetId: targetId || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true,
      },
    });

    return NextResponse.json(permission, { status: 201 });
  } catch (error) {
    console.error("POST /api/permissions error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
