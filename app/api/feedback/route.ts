import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createApiRateLimiter, checkRateLimit } from "@/lib/rate-limiter";
import { getRedisClient } from "@/lib/redis";
import { getClientIp } from "@/lib/get-client-ip";
import { logger } from "@/lib/logger";

// Issue #1217: rate limit feedback submissions (5 per minute per IP)
const redis = getRedisClient();
const feedbackLimiter = createApiRateLimiter({
  redisClient: redis ?? undefined,
  useMemory: !redis,
  points: 5,
  duration: 60,
});

/**
 * POST /api/feedback — User feedback collection (Issue #787).
 * Logs feedback to stdout for now. Can be extended to store in DB later.
 */
export async function POST(req: NextRequest) {
  // Rate limit check
  const ip = getClientIp(req) ?? "unknown";
  try {
    await checkRateLimit(feedbackLimiter, `feedback_${ip}`);
  } catch {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const session = await auth();
    const body = await req.json();
    const { message } = body as { message?: string };

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    // Log feedback — practical approach without requiring DB migration
    logger.info({
      type: "user_feedback",
      userId: session?.user?.id ?? "anonymous",
      userName: session?.user?.name ?? "anonymous",
      message: message.trim().slice(0, 5000),
      url: req.headers.get("referer") ?? null,
      userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
