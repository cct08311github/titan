import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * POST /api/feedback — User feedback collection (Issue #787).
 * Logs feedback to stdout for now. Can be extended to store in DB later.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const { message } = body as { message?: string };

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    // Log feedback — practical approach without requiring DB migration
    console.log(
      JSON.stringify({
        type: "user_feedback",
        userId: session?.user?.id ?? "anonymous",
        userName: session?.user?.name ?? "anonymous",
        message: message.trim().slice(0, 5000),
        url: req.headers.get("referer") ?? null,
        userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
        timestamp: new Date().toISOString(),
      })
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
