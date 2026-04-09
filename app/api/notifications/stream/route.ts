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
 * Fix #1360: Added connection limit (MAX_CONCURRENT_SSE), heartbeat hard-cap
 * lifetime (HEARTBEAT_MAX_LIFETIME_MS), and subscriber connect timeout
 * (SUBSCRIBER_CONNECT_TIMEOUT_MS) to prevent resource leaks on network drops
 * or browser crashes.
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

/** Hard cap on how long a single SSE connection may stay open (24 hours). */
const HEARTBEAT_MAX_LIFETIME_MS = 24 * 60 * 60 * 1000;

/** Max simultaneous SSE connections across all users.  Configurable via env. */
const MAX_CONCURRENT_SSE = Number(process.env.MAX_CONCURRENT_SSE ?? 500);

/** Timeout for ioredis duplicate().connect() — avoids indefinite hangs. */
const SUBSCRIBER_CONNECT_TIMEOUT_MS = 5_000;

/** Module-level counter; decremented atomically in the cleanup closure. */
let activeSSEConnections = 0;

export async function GET(req: NextRequest) {
  // Reject early if at capacity — before auth (cheap check first)
  if (activeSSEConnections >= MAX_CONCURRENT_SSE) {
    logger.warn(
      { event: "sse_capacity_exceeded", activeSSEConnections, limit: MAX_CONCURRENT_SSE },
      "[SSE] 連線數已達上限，拒絕新連線"
    );
    return new Response("Server at SSE capacity", {
      status: 503,
      headers: { "Retry-After": "30" },
    });
  }

  // Auth check — throws (redirects) if unauthenticated
  const session = await requireAuth();
  const userId = session.user.id;

  const encoder = new TextEncoder();

  activeSSEConnections++;
  let cleanedUp = false;

  const stream = new ReadableStream({
    async start(controller) {
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let lifetimeTimeout: ReturnType<typeof setTimeout> | null = null;
      let subscriber: Redis | null = null;

      const cleanup = async () => {
        if (cleanedUp) return;
        cleanedUp = true;

        if (heartbeat) clearInterval(heartbeat);
        if (lifetimeTimeout) clearTimeout(lifetimeTimeout);

        if (subscriber) {
          try {
            await subscriber.unsubscribe();
            await subscriber.quit();
          } catch {
            /* swallow cleanup errors */
          }
          subscriber = null;
        }

        try {
          controller.close();
        } catch {
          /* already closed */
        }

        activeSSEConnections = Math.max(0, activeSSEConnections - 1);
      };

      // ── 1. Confirm connection ──────────────────────────────────────────────
      controller.enqueue(encoder.encode("event: connected\ndata: {}\n\n"));

      // ── 2. Heartbeat — keeps nginx + browser connection alive ──────────────
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          // Controller closed (write-after-close) — trigger cleanup
          void cleanup();
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Hard lifetime cap: force-close after 24h to reclaim resources.
      // The browser EventSource will reconnect automatically.
      lifetimeTimeout = setTimeout(() => {
        logger.info(
          { event: "sse_lifetime_exceeded", userId },
          "[SSE] 連線達到最大存活時間，強制關閉"
        );
        void cleanup();
      }, HEARTBEAT_MAX_LIFETIME_MS);

      // ── 3. Set up per-connection Redis subscriber ──────────────────────────
      // We need a *dedicated* subscriber connection because ioredis switches a
      // client into subscriber mode on first subscribe() call.  We duplicate
      // the shared client so the main client stays usable for normal commands.
      const baseClient = getRedisClient();
      if (!baseClient) {
        // Redis unavailable — keep the heartbeat-only connection alive so the
        // browser retries on its normal EventSource backoff, then falls back to
        // slow polling.  cleanedUp is still false; cleanup fires on abort.
        logger.warn(
          { userId, event: "sse_redis_unavailable" },
          "[SSE] Redis client 不可用，SSE 連線無法訂閱通知（降級模式）"
        );
        req.signal.addEventListener("abort", () => void cleanup());
        return;
      }

      const channel = `notifications:user:${userId}`;

      try {
        subscriber = baseClient.duplicate();

        // ioredis duplicate() uses lazyConnect; connect explicitly with timeout
        // to avoid hanging indefinitely if Redis becomes unreachable mid-request.
        const connectPromise = subscriber.connect();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Subscriber connect timeout")),
            SUBSCRIBER_CONNECT_TIMEOUT_MS
          )
        );
        await Promise.race([connectPromise, timeoutPromise]);

        // Forward Redis messages to the SSE stream
        subscriber.on("message", (ch: string, message: string) => {
          if (ch !== channel) return;
          try {
            controller.enqueue(
              encoder.encode(`event: notification\ndata: ${message}\n\n`)
            );
          } catch {
            // Controller closed — abort handler will clean up
          }
        });

        await subscriber.subscribe(channel);

        logger.info({ userId, channel, event: "sse_connected" }, "[SSE] 客戶端已連線");
      } catch (err) {
        logger.warn(
          { err, userId, channel, event: "sse_subscribe_failed" },
          "[SSE] Redis subscriber 連線/訂閱失敗，降級為僅心跳模式"
        );
        // Degrade gracefully: keep heartbeat alive so the browser holds the
        // connection open and will receive notifications on retry.  Do NOT
        // call cleanup() here — heartbeat and lifetime timer are still running.
        if (subscriber) {
          try {
            await subscriber.quit();
          } catch {
            /* ignore */
          }
          subscriber = null;
        }
      }

      // ── 4. Cleanup on client disconnect ───────────────────────────────────
      req.signal.addEventListener("abort", () => {
        logger.info({ userId, event: "sse_disconnected" }, "[SSE] 客戶端中斷連線");
        void cleanup();
      });
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
