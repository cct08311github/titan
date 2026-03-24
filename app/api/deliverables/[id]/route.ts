import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) return NextResponse.json({ error: "未授權" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const deliverable = await prisma.deliverable.update({
      where: { id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.title !== undefined && { title: body.title }),
        ...(body.attachmentUrl !== undefined && { attachmentUrl: body.attachmentUrl }),
        ...(body.acceptedBy !== undefined && { acceptedBy: body.acceptedBy }),
        ...(body.acceptedAt !== undefined && { acceptedAt: body.acceptedAt ? new Date(body.acceptedAt) : null }),
      },
    });

    return NextResponse.json(deliverable);
  } catch (error) {
    console.error("PATCH /api/deliverables/[id] error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) return NextResponse.json({ error: "未授權" }, { status: 401 });

    const { id } = await params;
    await prisma.deliverable.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/deliverables/[id] error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
