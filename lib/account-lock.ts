/**
 * Account lockout service — Issue #128, Redis migration Issue #178
 *
 * Tracks per-account login failure counts and enforces lockout after N
 * consecutive failures. Supports Redis backend (production) with
 * in-memory fallback (tests/single-instance).
 */

import { logger } from "@/lib/logger";
import type Redis from "ioredis";

// ── Types ─────────────────────────────────────────────────────────────────

export interface AccountLockOptions {
  /** Number of consecutive failures before locking. Default: 10 */
  maxFailures?: number;
  /** How long (seconds) the lock lasts. Default: 900 (15 min) */
  lockDurationSeconds?: number;
  /** Redis client instance. If null, uses in-memory store. */
  redisClient?: Redis | null;
}

interface LockRecord {
  failures: number;
  lockedUntil: number | null; // epoch ms, or null when not locked
}

// ── AccountLockService ────────────────────────────────────────────────────

export class AccountLockService {
  private readonly maxFailures: number;
  private readonly lockDurationMs: number;
  private readonly redis: Redis | null;
  /** In-memory fallback store */
  private readonly memStore = new Map<string, LockRecord>();
  private static readonly KEY_PREFIX = "acctlock:";

  constructor(opts: AccountLockOptions = {}) {
    this.maxFailures = opts.maxFailures ?? 10;
    this.lockDurationMs = (opts.lockDurationSeconds ?? 900) * 1000;
    this.redis = opts.redisClient ?? null;
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private redisKey(id: string): string {
    return `${AccountLockService.KEY_PREFIX}${id}`;
  }

  private async getRecord(id: string): Promise<LockRecord> {
    if (this.redis) {
      try {
        const raw = await this.redis.get(this.redisKey(id));
        if (raw) {
          // Support both the new INCR-based integer format and legacy JSON format
          const asNumber = Number(raw);
          if (!Number.isNaN(asNumber) && !raw.startsWith("{")) {
            // INCR format — derive lock state from failure count and memory store
            const memRec = this.memStore.get(id);
            return {
              failures: asNumber,
              lockedUntil: asNumber >= this.maxFailures
                ? (memRec?.lockedUntil ?? Date.now() + this.lockDurationMs)
                : null,
            };
          }
          return JSON.parse(raw) as LockRecord;
        }
      } catch (err) {
        logger.error({ err, id }, "[account-lock] Redis read failed, using memory fallback");
      }
    }
    return this.memStore.get(id) ?? { failures: 0, lockedUntil: null };
  }

  private async setRecord(id: string, record: LockRecord): Promise<void> {
    if (this.redis) {
      try {
        // TTL = lock duration * 2 to ensure cleanup
        const ttlSeconds = Math.ceil((this.lockDurationMs * 2) / 1000);
        await this.redis.set(
          this.redisKey(id),
          JSON.stringify(record),
          "EX",
          ttlSeconds
        );
        return;
      } catch (err) {
        logger.error({ err, id }, "[account-lock] Redis write failed, using memory fallback");
      }
    }
    this.memStore.set(id, record);
  }

  private async deleteRecord(id: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(this.redisKey(id));
        return;
      } catch (err) {
        logger.error({ err, id }, "[account-lock] Redis delete failed");
      }
    }
    this.memStore.delete(id);
  }

  // ── Public API ───────────────────────────────────────────────────────

  /**
   * Atomically record a login failure for the given account ID.
   *
   * When Redis is available, uses INCR for an atomic counter to eliminate
   * the read-modify-write race condition (Issue #1444).  Falls back to the
   * in-memory read-modify-write path when Redis is unavailable.
   *
   * Returns the updated failure count and whether the account is now locked.
   */
  async recordFailure(id: string): Promise<{ locked: boolean; failures: number }> {
    if (this.redis) {
      try {
        const key = this.redisKey(id);
        const ttlSeconds = Math.ceil((this.lockDurationMs * 2) / 1000);
        // Atomic INCR + EXPIRE via pipeline to prevent split-write edge case:
        // if INCR succeeds but EXPIRE fails (connection drop mid-operation),
        // the counter key would persist forever without a TTL.
        const pipeline = this.redis.pipeline();
        pipeline.incr(key);
        pipeline.expire(key, ttlSeconds);
        const results = await pipeline.exec();
        const failures = (results?.[0]?.[1] as number) ?? 1;

        const locked = failures >= this.maxFailures;
        if (locked) {
          logger.warn(
            { accountId: id, failures },
            "[account-lock] Account locked after repeated failures"
          );
          // Refresh TTL to the full lock duration from the moment of locking
          const lockTtlSeconds = Math.ceil(this.lockDurationMs / 1000);
          await this.redis.expire(key, lockTtlSeconds);
        }

        // Sync back to memory so isLocked() fast-path stays consistent
        this.memStore.set(id, {
          failures,
          lockedUntil: locked ? Date.now() + this.lockDurationMs : null,
        });

        return { locked, failures };
      } catch (err) {
        logger.warn({ err, id }, "[account-lock] Redis INCR failed, falling back to memory");
      }
    }

    // Memory fallback (single-instance / Redis unavailable)
    const rec = this.memStore.get(id) ?? { failures: 0, lockedUntil: null };
    rec.failures += 1;

    const locked = rec.failures >= this.maxFailures;
    if (locked) {
      rec.lockedUntil = Date.now() + this.lockDurationMs;
      logger.warn(
        { accountId: id, failures: rec.failures },
        "[account-lock] Account locked after repeated failures (memory fallback)"
      );
    }

    this.memStore.set(id, rec);
    return { locked, failures: rec.failures };
  }

  async isLocked(id: string): Promise<boolean> {
    const rec = await this.getRecord(id);
    if (rec.lockedUntil === null) return false;

    if (Date.now() >= rec.lockedUntil) {
      // Lock has expired — auto-clear
      await this.deleteRecord(id);
      return false;
    }

    return true;
  }

  async getFailureCount(id: string): Promise<number> {
    return (await this.getRecord(id)).failures;
  }

  async resetFailures(id: string): Promise<void> {
    await this.deleteRecord(id);
  }

  async getRemainingLockSeconds(id: string): Promise<number> {
    const rec = await this.getRecord(id);
    if (rec.lockedUntil === null) return 0;

    const remaining = rec.lockedUntil - Date.now();
    if (remaining <= 0) return 0;

    return Math.ceil(remaining / 1000);
  }
}
