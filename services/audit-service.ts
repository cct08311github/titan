import { PrismaClient } from "@prisma/client";
import { ForbiddenError } from "./errors";
import { getRedisClient } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { hasMinimumRole } from "@/lib/auth/permissions";

const AUDIT_QUEUE_KEY = "titan:audit:failed:queue";
const MAX_QUEUE_SIZE = 10000;

const AUDIT_DRAIN_LOCK_KEY = "cron:lock:audit-drain";
const AUDIT_DRAIN_LOCK_TTL_SEC = 60;

export interface LogAuditInput {
  userId: string | null;
  action: string;
  module?: string;
  resourceType?: string;
  resourceId?: string | null;
  detail?: string | null;
  details?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  targetId?: string | null;
  targetType?: string | null;
}

export interface QueryAuditLogsInput {
  callerId: string;
  callerRole: string;
  action?: string;
  userId?: string;
  resourceType?: string;
  limit?: number;
  offset?: number;
}

export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Persist an audit log entry. All timestamps are generated server-side (UTC).
   * This method has no update/delete counterpart — audit logs are immutable.
   */
  async log(input: LogAuditInput) {
    return this.prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        resourceType: input.resourceType ?? input.targetType ?? "unknown",
        resourceId: input.resourceId ?? null,
        detail: input.detail ?? null,
        ipAddress: input.ipAddress ?? null,
        // createdAt is server-side UTC via Prisma @default(now())
      },
    });
  }

  /**
   * Fire-and-forget audit logging with Redis fallback queue.
   *
   * Primary: writes directly to Prisma (AuditLog table).
   * On Prisma failure: pushes to Redis queue for later retry.
   *
   * Callers should NOT await this method — it handles its own errors internally.
   */
  async logAsync(input: LogAuditInput): Promise<void> {
    try {
      await this.log(input);
    } catch (prismaErr) {
      logger.error(
        {
          event: "audit_write_failed",
          severity: "critical",
          action: input.action,
          userId: input.userId,
          err: prismaErr,
        },
        "Audit write failed"
      );
      await this.enqueueFailedAudit(input);
    }
  }

  /**
   * Enqueue a failed audit entry to Redis for later retry.
   */
  private async enqueueFailedAudit(input: LogAuditInput): Promise<void> {
    const redis = getRedisClient();
    if (!redis) {
      logger.warn("[audit] Redis unavailable, audit entry dropped");
      return;
    }

    try {
      const entry = JSON.stringify({
        ...input,
        failedAt: new Date().toISOString(),
      });
      await redis.lpush(AUDIT_QUEUE_KEY, entry);

      // Trim queue to prevent unbounded growth.
      // lpush adds newest entries at head (index 0); the tail holds oldest.
      // We keep the last MAX_QUEUE_SIZE entries (most recent = head side)
      // and discard the oldest tail entries.
      const size = await redis.llen(AUDIT_QUEUE_KEY);
      if (size > MAX_QUEUE_SIZE) {
        // ltrim(-MAX, -1) keeps the final MAX elements (newest), drops oldest
        await redis.ltrim(AUDIT_QUEUE_KEY, -MAX_QUEUE_SIZE, -1);
        logger.warn(
          {
            event: "audit_queue_trimmed",
            droppedCount: size - MAX_QUEUE_SIZE,
            severity: "critical",
          },
          "Audit queue exceeded capacity — dropped oldest entries"
        );
      }
    } catch (redisErr) {
      // Redis itself failed — log but don't throw (audit should not break main flow)
      logger.error(
        {
          event: "audit_queue_failed",
          severity: "critical",
          action: input.action,
          userId: input.userId,
          err: redisErr,
        },
        "Audit write failed"
      );
    }
  }

  /**
   * Process failed audit queue — retry entries from Redis into Prisma.
   *
   * Call this via cron job or during low-traffic periods.
   * Returns the number of entries successfully processed, or 0 if the lock
   * is already held by another cron invocation (skipped).
   *
   * Uses a Redis NX lock (TTL=60s) to prevent concurrent cron overlap.
   */
  async processAuditQueue(): Promise<number> {
    const redis = getRedisClient();
    if (!redis) {
      logger.warn("[audit] Redis unavailable for queue processing");
      return 0;
    }

    // Acquire lock — NX = only set if not exists, EX = expire after TTL seconds
    const acquired = await redis.set(
      AUDIT_DRAIN_LOCK_KEY,
      "1",
      "EX",
      AUDIT_DRAIN_LOCK_TTL_SEC,
      "NX"
    );
    if (!acquired) {
      logger.info(
        { event: "audit_drain_skipped_locked" },
        "[audit] Another audit-drain is running, skipping"
      );
      return 0;
    }

    let processed = 0;
    let dropped = 0;

    try {
      // Process up to 100 entries per call
      const entries = await redis.rpop(AUDIT_QUEUE_KEY, 100);
      if (!entries) return 0;

      const items = Array.isArray(entries) ? entries : [entries];

      for (const item of items) {
        if (!item) continue;
        try {
          const entry = JSON.parse(item) as LogAuditInput & { failedAt?: string };
          await this.log(entry);
          processed++;
        } catch (parseErr) {
          logger.error(
            { err: parseErr, item: item.slice(0, 100) },
            "[audit] Failed to parse queue entry"
          );
          dropped++;
        }
      }

      if (processed > 0) {
        logger.info({ processed, dropped }, "[audit] Queue processed");
      }
    } catch (err) {
      logger.error({ err }, "[audit] Queue processing error");
    } finally {
      try {
        await redis.del(AUDIT_DRAIN_LOCK_KEY);
      } catch {
        /* swallow */
      }
    }

    return processed;
  }

  /**
   * Returns the current audit failure queue status.
   * Useful for monitoring whether audit writes are failing.
   */
  async getQueueStatus(): Promise<{ depth: number; oldestEntryAt: string | null }> {
    const redis = getRedisClient();
    if (!redis) {
      return { depth: 0, oldestEntryAt: null };
    }

    try {
      const depth = await redis.llen(AUDIT_QUEUE_KEY);
      let oldestEntryAt: string | null = null;

      if (depth > 0) {
        // LINDEX -1 returns the oldest entry (rpop processes from tail)
        const oldest = await redis.lindex(AUDIT_QUEUE_KEY, -1);
        if (oldest) {
          try {
            const parsed = JSON.parse(oldest) as { failedAt?: string };
            oldestEntryAt = parsed.failedAt ?? null;
          } catch {
            // Malformed entry — report depth but no timestamp
          }
        }
      }

      return { depth, oldestEntryAt };
    } catch (err) {
      logger.error({ err }, "[audit] Failed to read queue status");
      return { depth: 0, oldestEntryAt: null };
    }
  }

  /**
   * Query audit logs. Only MANAGER role may call this.
   * Audit logs are read-only — no update or delete methods are exposed.
   */
  async queryLogs(input: QueryAuditLogsInput) {
    if (!hasMinimumRole(input.callerRole, "MANAGER")) {
      throw new ForbiddenError("權限不足：僅限管理員查詢稽核日誌");
    }

    const where: Record<string, unknown> = {};
    if (input.action) where.action = input.action;
    if (input.userId) where.userId = input.userId;
    if (input.resourceType) where.resourceType = input.resourceType;

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit ?? 200,
      skip: input.offset ?? 0,
    });
  }
}
