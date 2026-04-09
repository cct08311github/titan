/**
 * GET /api/notifications/stream
 *
 * Server-Sent Events endpoint — Issue #1322 (SSE 通知即時化)
 *
 * Subscribes the authenticated user to their personal Redis pub/sub channel
 * (`notifications:user:<userId>`) and forwards new notification events to the
 * browser in real time.  Replaces the 60-second polling loop in
 * NotificationBell.
 *
 * Connection lifecycle:
 *   1. Browser opens EventSource('/api/notifications/stream')
 *   2. Server sends a `connected` event immediately (confirms handshake)
 *   3. On each Redis message → server sends `notification` event with JSON payload
 *   4. Heartbeat comment (`: heartbeat`) every 15 s keeps the connection alive
 *      through nginx (proxy_read_timeout 24h on this path) and load balancers
 *   5. On browser disconnect (req.signal abort) → subscriber is cleaned up
 *
 * Fallback: if SSE errors, NotificationBell falls back to slow polling (5 min).
 * The initial notification list is still fetched via GET /api/notifications.
 *
 * Runtime: nodejs (SSE requires streaming — not supported on Edge runtime)
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { getRedisClient } from "@/lib/redis";
import { logger } from "@/lib/logger";
import Redis from "ioredis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Heartbeat interval in ms.  Nginx default proxy_read_timeout is 60 s. */
const HEARTBEAT_INTERVAL_MS = 15_000;

export async function GET(req: NextRequest) {
  // Auth check — throws (redirects) if unauthenticated
  const session = await requireAuth();
  const userId = session.user.id;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // ── 1. Confirm connection ──────────────────────────────────────────────
      controller.enqueue(encoder.encode("event: connected\ndata: {}\n\n"));

      // ── 2. Set up per-connection Redis subscriber ──────────────────────────
      // We need a *dedicated* subscriber connection because ioredis switches a
      // client into subscriber mode on first subscribe() call.  We duplicate
      // the shared client so the main client stays usable for normal commands.
      const baseClient = getRedisClient();
      if (!baseClient) {
        // Redis unavailable — keep the connection open but idle so the browser
        // retries on its normal EventSource backoff, then falls back to polling.
        logger.warn(
          { userId, event: "sse_redis_unavailable" },
          "[SSE] Redis client 不可用，SSE 連線無法訂閱通知"
        );
        // Still set up a heartbeat so the connection stays alive until the
        // client disconnects; the browser will fall back to slow polling.
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {
            clearInterval(heartbeat);
          }
        }, HEARTBEAT_INTERVAL_MS);

        req.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        });
        return;
      }

      let subscriber: Redis | null = null;
      try {
        subscriber = baseClient.duplicate();
        await subscriber.connect();
      } catch (err) {
        logger.warn(
          { err, userId, event: "sse_subscriber_connect_failed" },
          "[SSE] Redis subscriber 連線失敗"
        );
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        return;
      }

      const channel = `notifications:user:${userId}`;

      // Forward Redis messages to the SSE stream
      subscriber.on("message", (ch: string, message: string) => {
        if (ch !== channel) return;
        try {
          controller.enqueue(
            encoder.encode(`event: notification\ndata: ${message}\n\n`)
          );
        } catch {
          // Controller closed — subscriber cleanup happens in abort handler
        }
      });

      try {
        await subscriber.subscribe(channel);
      } catch (err) {
        logger.warn(
          { err, userId, channel, event: "sse_subscribe_failed" },
          "[SSE] Redis subscribe 失敗"
        );
        try {
          await subscriber.quit();
        } catch {
          /* ignore */
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        return;
      }

      // ── 3. Heartbeat — keeps nginx + browser connection alive ──────────────
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_INTERVAL_MS);

      // ── 4. Cleanup on client disconnect ───────────────────────────────────
      req.signal.addEventListener("abort", async () => {
        clearInterval(heartbeat);
        try {
          if (subscriber) {
            await subscriber.unsubscribe(channel);
            await subscriber.quit();
          }
        } catch {
          /* ignore cleanup errors */
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        logger.info({ userId, event: "sse_disconnected" }, "[SSE] 客戶端中斷連線");
      });

      logger.info({ userId, channel, event: "sse_connected" }, "[SSE] 客戶端已連線");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable nginx response buffering so events are flushed immediately
      "X-Accel-Buffering": "no",
    },
  });
}
