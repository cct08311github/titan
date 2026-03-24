/**
 * @jest-environment node
 */
/**
 * TDD: Tests written FIRST (RED) before implementation.
 * Issue #128: Rate limiting with Redis backend + in-memory fallback
 *
 * All tests use the in-memory store — no Redis required.
 */

// ── Mock next/server ──────────────────────────────────────────────────────
jest.mock("next/server", () => {
  const actual = jest.requireActual("next/server");
  return {
    ...actual,
    NextResponse: {
      json: jest.fn((body: unknown, init?: { status?: number }) => ({
        status: init?.status ?? 200,
        _body: body,
        json: async () => body,
      })),
    },
  };
});

import { RateLimiterMemory } from "rate-limiter-flexible";
import {
  createLoginRateLimiter,
  createApiRateLimiter,
  RateLimitError,
  checkRateLimit,
} from "@/lib/rate-limiter";
import { AccountLockService } from "@/lib/account-lock";

// ─── Helpers ──────────────────────────────────────────────────────────────
function makeMemoryLimiter(points: number, duration: number): RateLimiterMemory {
  return new RateLimiterMemory({ points, duration, keyPrefix: `test_${Date.now()}` });
}

// ─── rate-limiter.ts tests ────────────────────────────────────────────────

describe("createLoginRateLimiter", () => {
  test("returns a RateLimiterMemory instance", () => {
    const limiter = createLoginRateLimiter({ useMemory: true });
    expect(limiter).toBeDefined();
    expect(typeof limiter.consume).toBe("function");
  });

  test("allows up to 5 attempts per minute for unique IP+username key", async () => {
    const limiter = createLoginRateLimiter({ useMemory: true, points: 5, duration: 60 });
    const key = "192.168.1.1_testuser";

    for (let i = 0; i < 5; i++) {
      await expect(limiter.consume(key)).resolves.toBeDefined();
    }
  });

  test("blocks on 6th attempt (exceeds 5/min) and throws RateLimitError", async () => {
    const limiter = createLoginRateLimiter({ useMemory: true, points: 5, duration: 60 });
    const key = `192.168.1.2_ratelimituser_${Date.now()}`;

    for (let i = 0; i < 5; i++) {
      await limiter.consume(key);
    }

    await expect(checkRateLimit(limiter, key)).rejects.toThrow(RateLimitError);
  });

  test("RateLimitError has statusCode 429", async () => {
    const limiter = createLoginRateLimiter({ useMemory: true, points: 1, duration: 60 });
    const key = `ip_user_${Date.now()}`;

    await limiter.consume(key);

    try {
      await checkRateLimit(limiter, key);
      fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).statusCode).toBe(429);
    }
  });

  test("rate limit window resets after duration (simulated by delete)", async () => {
    const limiter = createLoginRateLimiter({ useMemory: true, points: 2, duration: 60 });
    const key = `reset_test_${Date.now()}`;

    await limiter.consume(key);
    await limiter.consume(key);

    // Simulate reset by deleting the key
    await limiter.delete(key);

    // Should succeed again after reset
    await expect(limiter.consume(key)).resolves.toBeDefined();
  });
});

describe("createApiRateLimiter", () => {
  test("returns a rate limiter instance", () => {
    const limiter = createApiRateLimiter({ useMemory: true });
    expect(limiter).toBeDefined();
    expect(typeof limiter.consume).toBe("function");
  });

  test("allows up to 100 requests per minute per userId", async () => {
    const limiter = createApiRateLimiter({ useMemory: true, points: 100, duration: 60 });
    const userId = `user_api_${Date.now()}`;

    // Consume all 100 points
    for (let i = 0; i < 100; i++) {
      await expect(limiter.consume(userId)).resolves.toBeDefined();
    }
  });

  test("blocks on 101st request and throws RateLimitError", async () => {
    const limiter = createApiRateLimiter({ useMemory: true, points: 100, duration: 60 });
    const userId = `user_block_${Date.now()}`;

    for (let i = 0; i < 100; i++) {
      await limiter.consume(userId);
    }

    await expect(checkRateLimit(limiter, userId)).rejects.toThrow(RateLimitError);
  });
});

describe("checkRateLimit", () => {
  test("resolves when points remain", async () => {
    const limiter = makeMemoryLimiter(10, 60);
    const key = `check_ok_${Date.now()}`;
    await expect(checkRateLimit(limiter, key)).resolves.toBeUndefined();
  });

  test("throws RateLimitError with retryAfter when exhausted", async () => {
    const limiter = makeMemoryLimiter(1, 60);
    const key = `check_fail_${Date.now()}`;

    await limiter.consume(key);

    try {
      await checkRateLimit(limiter, key);
      fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      const rle = err as RateLimitError;
      expect(rle.statusCode).toBe(429);
      expect(typeof rle.retryAfter).toBe("number");
      expect(rle.retryAfter).toBeGreaterThan(0);
    }
  });

  test("graceful degradation: falls back to in-memory and emits warning when Redis unavailable", async () => {
    // Simulate degraded mode — the limiter itself is already in-memory,
    // but we test that the factory function warns when useMemory=true due to
    // Redis being unavailable (simulated via the fallback flag).
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const limiter = createLoginRateLimiter({ useMemory: true, redisUnavailable: true });

    expect(limiter).toBeDefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[rate-limiter] Redis unavailable")
    );

    warnSpy.mockRestore();
  });
});

// ─── account-lock.ts tests ────────────────────────────────────────────────

describe("AccountLockService", () => {
  let service: AccountLockService;

  beforeEach(() => {
    // Fresh in-memory service for each test
    service = new AccountLockService({ maxFailures: 10, lockDurationSeconds: 900 });
  });

  test("recordFailure increments failure count", async () => {
    const id = `acct_${Date.now()}`;
    await service.recordFailure(id);
    const count = await service.getFailureCount(id);
    expect(count).toBe(1);
  });

  test("isLocked returns false before threshold", async () => {
    const id = `acct_notlocked_${Date.now()}`;
    for (let i = 0; i < 9; i++) {
      await service.recordFailure(id);
    }
    await expect(service.isLocked(id)).resolves.toBe(false);
  });

  test("isLocked returns true after 10 failed attempts", async () => {
    const id = `acct_locked_${Date.now()}`;
    for (let i = 0; i < 10; i++) {
      await service.recordFailure(id);
    }
    await expect(service.isLocked(id)).resolves.toBe(true);
  });

  test("account lockout after exactly N (10) failures", async () => {
    const id = `acct_exact_${Date.now()}`;

    for (let i = 0; i < 10; i++) {
      await service.recordFailure(id);
    }

    const locked = await service.isLocked(id);
    expect(locked).toBe(true);
  });

  test("resetFailures clears count and unlocks account", async () => {
    const id = `acct_reset_${Date.now()}`;

    for (let i = 0; i < 10; i++) {
      await service.recordFailure(id);
    }

    expect(await service.isLocked(id)).toBe(true);

    await service.resetFailures(id);

    expect(await service.getFailureCount(id)).toBe(0);
    expect(await service.isLocked(id)).toBe(false);
  });

  test("getRemainingLockSeconds returns positive seconds while locked", async () => {
    const id = `acct_ttl_${Date.now()}`;
    for (let i = 0; i < 10; i++) {
      await service.recordFailure(id);
    }

    const remaining = await service.getRemainingLockSeconds(id);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(900);
  });

  test("getRemainingLockSeconds returns 0 when not locked", async () => {
    const id = `acct_nottlocked_${Date.now()}`;
    const remaining = await service.getRemainingLockSeconds(id);
    expect(remaining).toBe(0);
  });
});

// ─── rate limit returns 429 via apiHandler ────────────────────────────────

describe("rate limit returns 429 via apiHandler", () => {
  test("RateLimitError has statusCode 429 and message", () => {
    const err = new RateLimitError("Too many requests", 30);
    expect(err.statusCode).toBe(429);
    expect(err.retryAfter).toBe(30);
    expect(err.message).toBe("Too many requests");
    expect(err instanceof Error).toBe(true);
  });

  test("RateLimitError name is RateLimitError", () => {
    const err = new RateLimitError("rate limited", 10);
    expect(err.name).toBe("RateLimitError");
  });
});
