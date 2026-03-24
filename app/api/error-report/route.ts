import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * POST /api/error-report — Client-side error reporting (Issue #196).
 * Persists frontend errors to AuditLog for tracking and investigation.
 * No auth required — errors may occur before/during auth flows.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, digest, source, url } = body as {
      message?: string;
      digest?: string;
      source?: string;
      url?: string;
    };

    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    const detail = JSON.stringify({
      message: String(message).slice(0, 2000),
      digest: digest ?? null,
      source: source ?? "unknown",
      url: url ?? null,
      userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    });

    await prisma.auditLog.create({
      data: {
        userId: null,
        action: "FRONTEND_ERROR",
        resourceType: "error",
        resourceId: digest ?? null,
        detail,
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      },
    });

    logger.warn({ source, url, digest }, `Frontend error: ${String(message).slice(0, 200)}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to persist error report");
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
