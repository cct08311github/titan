/**
 * TDD Tests for TS-02: hours 自動計算（0.25h 最小單位）
 * and TS-05: Timer start/stop logic
 *
 * RED phase: these tests should FAIL before implementation.
 */
import { calculateHours } from "../time-entry-service";

describe("calculateHours (TS-02)", () => {
  test("returns hours rounded up to nearest 0.25", () => {
    // 1 hour exactly
    const start = new Date("2026-03-25T09:00:00Z");
    const end = new Date("2026-03-25T10:00:00Z");
    expect(calculateHours(start, end)).toBe(1.0);
  });

  test("7 minutes rounds up to 0.25", () => {
    const start = new Date("2026-03-25T09:00:00Z");
    const end = new Date("2026-03-25T09:07:00Z");
    expect(calculateHours(start, end)).toBe(0.25);
  });

  test("16 minutes rounds up to 0.5", () => {
    const start = new Date("2026-03-25T09:00:00Z");
    const end = new Date("2026-03-25T09:16:00Z");
    expect(calculateHours(start, end)).toBe(0.5);
  });

  test("15 minutes exactly equals 0.25", () => {
    const start = new Date("2026-03-25T09:00:00Z");
    const end = new Date("2026-03-25T09:15:00Z");
    expect(calculateHours(start, end)).toBe(0.25);
  });

  test("30 minutes exactly equals 0.5", () => {
    const start = new Date("2026-03-25T09:00:00Z");
    const end = new Date("2026-03-25T09:30:00Z");
    expect(calculateHours(start, end)).toBe(0.5);
  });

  test("31 minutes rounds up to 0.75", () => {
    const start = new Date("2026-03-25T09:00:00Z");
    const end = new Date("2026-03-25T09:31:00Z");
    expect(calculateHours(start, end)).toBe(0.75);
  });

  test("8 hours 1 minute rounds up to 8.25", () => {
    const start = new Date("2026-03-25T09:00:00Z");
    const end = new Date("2026-03-25T17:01:00Z");
    expect(calculateHours(start, end)).toBe(8.25);
  });

  test("returns 0 when start equals end", () => {
    const t = new Date("2026-03-25T09:00:00Z");
    expect(calculateHours(t, t)).toBe(0);
  });

  test("throws when end is before start", () => {
    const start = new Date("2026-03-25T10:00:00Z");
    const end = new Date("2026-03-25T09:00:00Z");
    expect(() => calculateHours(start, end)).toThrow();
  });

  test("returns null when start is null", () => {
    expect(calculateHours(null, new Date())).toBeNull();
  });

  test("returns null when end is null", () => {
    expect(calculateHours(new Date(), null)).toBeNull();
  });
});
