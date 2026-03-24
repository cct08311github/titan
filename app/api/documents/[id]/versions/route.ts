import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }
    const { id } = await params;
    const versions = await prisma.documentVersion.findMany({
      where: { documentId: id },
      include: { creator: { select: { id: true, name: true } } },
      orderBy: { version: "desc" },
    });
    return NextResponse.json(versions);
  } catch (error) {
    console.error("GET /api/documents/[id]/versions error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
