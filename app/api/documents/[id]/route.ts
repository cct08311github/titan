import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { ValidationError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { updateDocumentSchema } from "@/validators/document-validators";

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
    const doc = await prisma.document.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true } },
        updater: { select: { id: true, name: true } },
        children: {
          select: { id: true, title: true, slug: true },
          orderBy: { title: "asc" },
        },
      },
    });
    if (!doc) return NextResponse.json({ error: "文件不存在" }, { status: 404 });
    return NextResponse.json(doc);
  } catch (error) {
    console.error("GET /api/documents/[id] error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }
    const { id } = await params;
    const raw = await req.json();
    const { title, content, parentId } = validateBody(updateDocumentSchema, raw);

    const existing = await prisma.document.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "文件不存在" }, { status: 404 });

    const newVersion = existing.version + 1;

    await prisma.documentVersion.create({
      data: {
        documentId: id,
        content: existing.content,
        version: existing.version,
        createdBy: session.user.id,
      },
    });

    const updates: Record<string, unknown> = { updatedBy: session.user.id, version: newVersion };
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (parentId !== undefined) updates.parentId = parentId || null;

    const doc = await prisma.document.update({
      where: { id },
      data: updates,
      include: {
        creator: { select: { id: true, name: true } },
        updater: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(doc);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("PUT /api/documents/[id] error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }
    const { id } = await params;
    await prisma.document.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/documents/[id] error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
