import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { ValidationError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { createDocumentSchema } from "@/validators/document-validators";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const docs = await prisma.document.findMany({
      select: {
        id: true,
        parentId: true,
        title: true,
        slug: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        creator: { select: { id: true, name: true } },
        updater: { select: { id: true, name: true } },
        _count: { select: { children: true } },
      },
      orderBy: [{ parentId: "asc" }, { title: "asc" }],
    });

    return NextResponse.json(docs);
  } catch (error) {
    console.error("GET /api/documents error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const raw = await req.json();
    const { title, content, parentId } = validateBody(createDocumentSchema, raw);

    const base = title
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
      .replace(/^-|-$/g, "");
    const timestamp = Date.now();
    const slug = `${base}-${timestamp}`;

    const doc = await prisma.document.create({
      data: {
        parentId: parentId || null,
        title,
        content: content ?? "",
        slug,
        createdBy: session.user.id,
        updatedBy: session.user.id,
        version: 1,
      },
      include: {
        creator: { select: { id: true, name: true } },
        updater: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/documents error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
