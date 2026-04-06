/**
 * @jest-environment node
 */
/**
 * Tests for daily timesheet validation — Issue #813 (T-1)
 *
 * Covers:
 * - 0.5hr minimum unit validation
 * - 24hr daily limit enforcement
 * - Shared validator functions
 */

import { createTimeEntrySchema, validateDailyLimit } from "@/validators/shared/time-entry";

describe("Time Entry Validator — 0.5hr minimum unit", () => {
  it("accepts 0.5 hours", () => {
    const result = createTimeEntrySchema.safeParse({ date: "2026-03-26", hours: 0.5 });
    expect(result.success).toBe(true);
  });

  it("accepts 1.0 hours", () => {
    const result = createTimeEntrySchema.safeParse({ date: "2026-03-26", hours: 1.0 });
    expect(result.success).toBe(true);
  });

  it("accepts 1.5 hours", () => {
    const result = createTimeEntrySchema.safeParse({ date: "2026-03-26", hours: 1.5 });
    expect(result.success).toBe(true);
  });

  it("accepts 8.0 hours", () => {
    const result = createTimeEntrySchema.safeParse({ date: "2026-03-26", hours: 8.0 });
    expect(result.success).toBe(true);
  });

  it("accepts 24 hours (max)", () => {
    const result = createTimeEntrySchema.safeParse({ date: "2026-03-26", hours: 24 });
    expect(result.success).toBe(true);
  });

  it("rejects 0 hours (must be gt(0))", () => {
    const result = createTimeEntrySchema.safeParse({ date: "2026-03-26", hours: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects 0.3 hours (not 0.5 increment)", () => {
    const result = createTimeEntrySchema.safeParse({ date: "2026-03-26", hours: 0.3 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("0.5");
    }
  });

  it("rejects 1.7 hours (not 0.5 increment)", () => {
    const result = createTimeEntrySchema.safeParse({ date: "2026-03-26", hours: 1.7 });
    expect(result.success).toBe(false);
  });

  it("rejects 2.25 hours (not 0.5 increment)", () => {
    const result = createTimeEntrySchema.safeParse({ date: "2026-03-26", hours: 2.25 });
    expect(result.success).toBe(false);
  });

  it("rejects negative hours", () => {
    const result = createTimeEntrySchema.safeParse({ date: "2026-03-26", hours: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects hours > 24", () => {
    const result = createTimeEntrySchema.safeParse({ date: "2026-03-26", hours: 25 });
    expect(result.success).toBe(false);
  });
});

describe("validateDailyLimit", () => {
  it("allows entry when under 24hr limit", () => {
    expect(validateDailyLimit(8, 4)).toBeNull();
  });

  it("allows entry that exactly reaches 24hr", () => {
    expect(validateDailyLimit(16, 8)).toBeNull();
  });

  it("rejects entry that exceeds 24hr", () => {
    const error = validateDailyLimit(20, 5);
    expect(error).not.toBeNull();
    expect(error).toContain("24");
    expect(error).toContain("25");
  });

  it("allows 0hr new entry when day is full", () => {
    expect(validateDailyLimit(24, 0)).toBeNull();
  });

  it("rejects any positive hours when day is already at 24", () => {
    const error = validateDailyLimit(24, 0.5);
    expect(error).not.toBeNull();
  });

  it("allows first entry of the day", () => {
    expect(validateDailyLimit(0, 8)).toBeNull();
  });

  it("rejects single entry > 24hr", () => {
    // This would be caught by schema first, but validateDailyLimit also catches it
    const error = validateDailyLimit(0, 25);
    expect(error).not.toBeNull();
  });

  it("calculates total correctly with decimals", () => {
    expect(validateDailyLimit(23.5, 0.5)).toBeNull();
    expect(validateDailyLimit(23.5, 1)).not.toBeNull();
  });
});
