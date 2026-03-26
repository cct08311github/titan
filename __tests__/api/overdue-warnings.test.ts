/**
 * @jest-environment node
 */
/**
 * Overdue Task Warnings — Issue #809 (D-3)
 *
 * Tests the overdue detection logic and API usage.
 * Overdue = dueDate 23:59:59 (Asia/Taipei) has passed AND status !== DONE.
 */

import { isOverdue, overdueDays } from "@/lib/utils/overdue";

describe("isOverdue (D-3)", () => {
  // Use a fixed "now" for tests
  const realDate = Date;

  function mockDate(isoDate: string) {
    const fixed = new realDate(isoDate);
    jest.spyOn(globalThis, "Date").mockImplementation((...args: unknown[]) => {
      if (args.length === 0) return fixed;
      // @ts-expect-error spread constructor
      return new realDate(...args);
    });
    // Preserve static methods
    (globalThis.Date as unknown as typeof realDate).now = () => fixed.getTime();
    (globalThis.Date as unknown as typeof realDate).parse = realDate.parse;
    (globalThis.Date as unknown as typeof realDate).UTC = realDate.UTC;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns false when dueDate is null", () => {
    expect(isOverdue(null, "TODO")).toBe(false);
  });

  it("returns false when dueDate is undefined", () => {
    expect(isOverdue(undefined, "TODO")).toBe(false);
  });

  it("returns false when status is DONE even if past due", () => {
    // Now = 2026-03-27 10:00 Taipei
    mockDate("2026-03-27T02:00:00.000Z"); // 10:00 Taipei
    expect(isOverdue("2026-03-25T00:00:00.000Z", "DONE")).toBe(false);
  });

  it("returns true when dueDate has passed and status is not DONE", () => {
    // Now = 2026-03-27 10:00 Taipei, due = 2026-03-25
    mockDate("2026-03-27T02:00:00.000Z"); // 10:00 Taipei
    expect(isOverdue("2026-03-25T00:00:00.000Z", "TODO")).toBe(true);
    expect(isOverdue("2026-03-25T00:00:00.000Z", "IN_PROGRESS")).toBe(true);
  });

  it("returns false when due date is today and day has not ended in Asia/Taipei", () => {
    // Now = 2026-03-26 10:00 Taipei (still before 23:59:59)
    // Due = 2026-03-26
    mockDate("2026-03-26T02:00:00.000Z"); // 10:00 Taipei
    expect(isOverdue("2026-03-26T00:00:00.000Z", "TODO")).toBe(false);
  });

  it("returns true when due date has ended in Asia/Taipei (past 23:59:59)", () => {
    // Now = 2026-03-27 00:30 Taipei = 2026-03-26 16:30 UTC
    // Due = 2026-03-26 (23:59:59 Taipei = 15:59:59 UTC, which is < 16:30 UTC)
    mockDate("2026-03-26T16:30:00.000Z"); // 00:30 next day Taipei
    expect(isOverdue("2026-03-26T00:00:00.000Z", "TODO")).toBe(true);
  });

  it("returns false for tasks with no dueDate", () => {
    mockDate("2026-03-27T02:00:00.000Z");
    expect(isOverdue(null, "IN_PROGRESS")).toBe(false);
  });
});

describe("overdueDays (D-3)", () => {
  const realDate = Date;

  function mockDate(isoDate: string) {
    const fixed = new realDate(isoDate);
    jest.spyOn(globalThis, "Date").mockImplementation((...args: unknown[]) => {
      if (args.length === 0) return fixed;
      // @ts-expect-error spread constructor
      return new realDate(...args);
    });
    (globalThis.Date as unknown as typeof realDate).now = () => fixed.getTime();
    (globalThis.Date as unknown as typeof realDate).parse = realDate.parse;
    (globalThis.Date as unknown as typeof realDate).UTC = realDate.UTC;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 0 when not overdue", () => {
    mockDate("2026-03-26T02:00:00.000Z");
    expect(overdueDays("2026-03-26T00:00:00.000Z", "TODO")).toBe(0);
    expect(overdueDays(null, "TODO")).toBe(0);
    expect(overdueDays("2026-03-20T00:00:00.000Z", "DONE")).toBe(0);
  });

  it("calculates correct overdue days", () => {
    // Now = 2026-03-28 10:00 Taipei, due = 2026-03-25
    // Overdue by 3 days
    mockDate("2026-03-28T02:00:00.000Z");
    expect(overdueDays("2026-03-25T00:00:00.000Z", "TODO")).toBe(3);
  });

  it("returns 1 for task due yesterday", () => {
    // Now = 2026-03-27 10:00 Taipei, due = 2026-03-26
    mockDate("2026-03-27T02:00:00.000Z");
    expect(overdueDays("2026-03-26T00:00:00.000Z", "IN_PROGRESS")).toBe(1);
  });
});
