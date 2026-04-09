/**
 * Push notification dispatcher — Issue #1354
 *
 * Two public functions:
 *  - queueForPush()      — enqueue a notification for push delivery (non-fatal)
 *  - dispatchPushQueue() — drain the Redis queue and send via Expo Push API
 *
 * Design goals:
 *  - Decouples notification creation from push delivery
 *  - Non-fatal: push failures never block notification persistence
 *  - Air-gapped safe: if Expo API is unreachable, queue drains with warnings
 *    and tokens are NOT deactivated (only DeviceNotRegistered deactivates)
 */

import { PrismaClient } from "@prisma/client";
import { getRedisClient } from "@/lib/redis";
import { logger } from "@/lib/logger";

const PUSH_QUEUE_KEY = "push:queue";
const MAX_QUEUE_SIZE = 10_000;
const EXPO_API_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100; // Expo API limit per request

export interface PushPayload {
  notificationId: string;
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Enqueue a notification for push delivery.
 * Non-fatal: if Redis is down, push is silently skipped — the notification
 * record already exists in DB and the user will see it on next poll.
 */
export async function queueForPush(payload: PushPayload): Promise<void> {
  try {
    const redis = getRedisClient();
    if (!redis) return;

    const size = await redis.llen(PUSH_QUEUE_KEY);
    if (size >= MAX_QUEUE_SIZE) {
      logger.warn(
        { event: "push_queue_full", size },
        "[push-dispatcher] Push queue at capacity, trimming oldest entries"
      );
      await redis.ltrim(PUSH_QUEUE_KEY, -(MAX_QUEUE_SIZE - 1), -1);
    }

    await redis.rpush(PUSH_QUEUE_KEY, JSON.stringify(payload));
  } catch (err) {
    logger.warn(
      { err, event: "push_enqueue_failed", userId: payload.userId },
      "[push-dispatcher] Failed to enqueue push notification"
    );
  }
}

interface ExpoTicket {
  status: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: string;
}

/**
 * Drain the push queue and dispatch via Expo Push API.
 * Returns observability counts: { drained, sent, failed, deactivated }
 *
 * Idempotent: safe to call multiple times concurrently (Redis lpop is atomic).
 */
export async function dispatchPushQueue(prisma: PrismaClient): Promise<{
  drained: number;
  sent: number;
  failed: number;
  deactivated: number;
}> {
  const redis = getRedisClient();
  if (!redis) {
    logger.warn(
      { event: "push_dispatch_skipped" },
      "[push-dispatcher] Redis unavailable, skipping push dispatch"
    );
    return { drained: 0, sent: 0, failed: 0, deactivated: 0 };
  }

  let drained = 0;
  let sent = 0;
  let failed = 0;
  let deactivated = 0;

  // Drain in batches of EXPO_BATCH_SIZE
  while (true) {
    const items: string[] = [];
    for (let i = 0; i < EXPO_BATCH_SIZE; i++) {
      const item = await redis.lpop(PUSH_QUEUE_KEY);
      if (!item) break;
      items.push(item);
    }
    if (items.length === 0) break;
    drained += items.length;

    // Group payloads, fetch active tokens once per unique userId
    const payloads = items.map((s) => JSON.parse(s) as PushPayload);
    const userIds = [...new Set(payloads.map((p) => p.userId))];

    const tokens = await prisma.pushToken.findMany({
      where: { userId: { in: userIds }, isActive: true },
      select: { token: true, userId: true },
    });

    // Build a userId → token[] lookup
    const tokensByUser = new Map<string, string[]>();
    for (const t of tokens) {
      const list = tokensByUser.get(t.userId) ?? [];
      list.push(t.token);
      tokensByUser.set(t.userId, list);
    }

    // Build Expo message objects, one per (payload × token)
    const messages: ExpoMessage[] = payloads.flatMap((p) => {
      const userTokens = tokensByUser.get(p.userId) ?? [];
      return userTokens.map((token) => ({
        to: token,
        title: p.title,
        body: p.body,
        data: { ...p.data, notificationId: p.notificationId },
        sound: "default",
      }));
    });

    if (messages.length === 0) continue;

    // Send to Expo Push API
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      const accessToken = process.env.EXPO_ACCESS_TOKEN;
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      const response = await fetch(EXPO_API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        failed += messages.length;
        logger.warn(
          { status: response.status, event: "push_dispatch_http_error" },
          "[push-dispatcher] Expo Push API returned non-OK status"
        );
        continue;
      }

      const result = (await response.json()) as {
        data?: ExpoTicket[];
      };
      const tickets = result.data ?? [];

      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        if (ticket.status === "ok") {
          sent++;
        } else {
          failed++;
          // DeviceNotRegistered: token is stale — deactivate so we stop sending to it.
          // Network / server errors keep the token active (air-gapped mode: may be unreachable).
          if (ticket.details?.error === "DeviceNotRegistered") {
            const badToken = messages[i]?.to;
            if (badToken) {
              await prisma.pushToken.updateMany({
                where: { token: badToken },
                data: { isActive: false },
              });
              deactivated++;
              logger.info(
                { event: "push_token_deactivated", token: badToken.slice(0, 20) },
                "[push-dispatcher] Deactivated stale push token"
              );
            }
          } else {
            logger.warn(
              {
                event: "push_ticket_error",
                status: ticket.status,
                errorCode: ticket.details?.error,
                message: ticket.message,
              },
              "[push-dispatcher] Expo push ticket error"
            );
          }
        }
      }
    } catch (err) {
      // Network failure (air-gapped / Expo unreachable) — keep tokens active
      failed += messages.length;
      logger.warn(
        { err, event: "push_dispatch_network_error", count: messages.length },
        "[push-dispatcher] Failed to reach Expo Push API (air-gapped mode?)"
      );
    }
  }

  return { drained, sent, failed, deactivated };
}
