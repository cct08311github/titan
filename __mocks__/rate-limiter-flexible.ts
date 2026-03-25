/**
 * Mock for rate-limiter-flexible — used by Jest tests
 *
 * The real rate-limiter-flexible requires Redis or in-memory store.
 * This mock provides a no-op implementation that always allows requests.
 */

export class RateLimiterRedis {
  consume = jest.fn().mockResolvedValue({ remainingPoints: 99, msBeforeNext: 0 });
  get = jest.fn().mockResolvedValue(null);
  delete = jest.fn().mockResolvedValue(true);
  block = jest.fn().mockResolvedValue(true);
}

export class RateLimiterMemory {
  consume = jest.fn().mockResolvedValue({ remainingPoints: 99, msBeforeNext: 0 });
  get = jest.fn().mockResolvedValue(null);
  delete = jest.fn().mockResolvedValue(true);
  block = jest.fn().mockResolvedValue(true);
}

export class RateLimiterAbstract {
  consume = jest.fn().mockResolvedValue({ remainingPoints: 99, msBeforeNext: 0 });
  get = jest.fn().mockResolvedValue(null);
  delete = jest.fn().mockResolvedValue(true);
}

export class RateLimiterRes {
  remainingPoints = 99;
  msBeforeNext = 0;
  consumedPoints = 1;
  isFirstInDuration = false;
}
