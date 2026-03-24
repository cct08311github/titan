/**
 * Account lockout service — Issue #128
 *
 * Tracks per-account login failure counts and enforces lockout after N
 * consecutive failures.  Uses an in-memory store by default (suitable for
 * tests and single-instance deployments) with a TTL-based expiry.
 *
 * In production, swap the in-memory store for Redis via the constructor opts.
 */

import { logger } from "@/lib/logger";

// ── Types ─────────────────────────────────────────────────────────────────

export interface AccountLockOptions {
  /** Number of consecutive failures before locking. Default: 10 */
  maxFailures?: number;
  /** How long (seconds) the lock lasts. Default: 900 (15 min) */
  lockDurationSeconds?: number;
}

interface LockRecord {
  failures: number;
  lockedUntil: number | null; // epoch ms, or null when not locked
}

// ── AccountLockService ────────────────────────────────────────────────────

/**
 * Tracks login failures and locks accounts after exceeding the threshold.
 *
 * Key: any string identifier (userId, username, or IP+username).
 */
export class AccountLockService {
  private readonly maxFailures: number;
  private readonly lockDurationMs: number;
  /** In-memory store: key → LockRecord */
  private readonly store = new Map<string, LockRecord>();

  constructor(opts: AccountLockOptions = {}) {
    this.maxFailures = opts.maxFailures ?? 10;
    this.lockDurationMs = (opts.lockDurationSeconds ?? 900) * 1000;
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private getRecord(id: string): LockRecord {
    return this.store.get(id) ?? { failures: 0, lockedUntil: null };
  }

  private setRecord(id: string, record: LockRecord): void {
    this.store.set(id, record);
  }

  // ── Public API ───────────────────────────────────────────────────────

  /**
   * Record one failed login attempt for the given account id.
   * Locks the account when the failure count reaches maxFailures.
   */
  async recordFailure(id: string): Promise<void> {
    const rec = this.getRecord(id);
    rec.failures += 1;

    if (rec.failures >= this.maxFailures) {
      rec.lockedUntil = Date.now() + this.lockDurationMs;
      logger.warn(
        { accountId: id, failures: rec.failures },
        "[account-lock] Account locked after repeated failures"
      );
    }

    this.setRecord(id, rec);
  }

  /**
   * Returns true if the account is currently locked.
   * Automatically clears an expired lock.
   */
  async isLocked(id: string): Promise<boolean> {
    const rec = this.getRecord(id);
    if (rec.lockedUntil === null) return false;

    if (Date.now() >= rec.lockedUntil) {
      // Lock has expired — auto-clear
      rec.lockedUntil = null;
      rec.failures = 0;
      this.setRecord(id, rec);
      return false;
    }

    return true;
  }

  /** Returns current failure count (0 if no record). */
  async getFailureCount(id: string): Promise<number> {
    return this.getRecord(id).failures;
  }

  /**
   * Clears the failure count and removes any lock.
   * Call this on successful login.
   */
  async resetFailures(id: string): Promise<void> {
    this.store.delete(id);
  }

  /**
   * Returns how many seconds remain on the current lock.
   * Returns 0 if the account is not locked.
   */
  async getRemainingLockSeconds(id: string): Promise<number> {
    const rec = this.getRecord(id);
    if (rec.lockedUntil === null) return 0;

    const remaining = rec.lockedUntil - Date.now();
    if (remaining <= 0) return 0;

    return Math.ceil(remaining / 1000);
  }
}
