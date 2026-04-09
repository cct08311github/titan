/**
 * POST /api/cron/push-dispatch — Drain Redis push queue and deliver via Expo (Issue #1354)
 *
 * Called every minute by titan-cron. Drains push:queue from Redis, groups
 * messages by user, fetches active PushTokens, and sends via Expo Push API.
 *
 * Protected by CRON_SECRET header (timingSafeEqual via verifyCronSecret).
 * Non-fatal: if Expo is unreachable (air-gapped), queue drains with warnings.
 */

import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";
import { verifyCronSecret } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { dispatchPushQueue } from "@/lib/push-dispatcher";
import { logger } from "@/lib/logger";

export const POST = apiHandler(async (req: NextRequest) => {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const result = await dispatchPushQueue(prisma);

  logger.info(
    { event: "cron_push_dispatch_complete", ...result },
    "[cron/push-dispatch] Push dispatch complete"
  );

  return success({ ...result, timestamp: new Date().toISOString() });
});
