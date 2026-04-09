/**
 * Notification Redis publisher — Issue #1322 (SSE 通知即時化)
 *
 * Thin wrapper around getRedisClient().publish() used by every code path that
 * creates a Notification record.  If Redis is unavailable the publish is
 * silently skipped — the notification already exists in the DB and the
 * existing polling fallback (or next EventSource reconnect) will pick it up.
 */

import { getRedisClient } from "@/lib/redis";
import { logger } from "@/lib/logger";

export interface NotificationPayload {
  id: string;
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  isRead: boolean;
  createdAt: Date | string;
  relatedId?: string | null;
  relatedType?: string | null;
}

/**
 * Publishes a single notification event to the user's Redis pub/sub channel.
 * Non-fatal: errors are logged at WARN level but never thrown.
 */
export async function publishNotification(
  notification: NotificationPayload
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return; // Redis unavailable — silent skip

  try {
    await redis.publish(
      `notifications:user:${notification.userId}`,
      JSON.stringify(notification)
    );
  } catch (err) {
    logger.warn(
      { err, event: "notification_publish_failed", userId: notification.userId },
      "[notification-publisher] Redis publish 失敗，SSE 推送略過"
    );
  }
}

/**
 * Publishes multiple notification events.  Each notification goes to its own
 * user channel.  Errors on individual publishes are caught and logged without
 * aborting the remaining items.
 */
export async function publishNotifications(
  notifications: NotificationPayload[]
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return; // Redis unavailable — silent skip

  await Promise.allSettled(
    notifications.map(async (n) => {
      try {
        await redis.publish(
          `notifications:user:${n.userId}`,
          JSON.stringify(n)
        );
      } catch (err) {
        logger.warn(
          { err, event: "notification_publish_failed", userId: n.userId },
          "[notification-publisher] Redis publish 失敗，SSE 推送略過"
        );
      }
    })
  );
}
