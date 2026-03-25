/**
 * Tests for lib/utils/date.ts — formatLocalDate
 *
 * Verifies that formatLocalDate produces YYYY-MM-DD based on
 * the Date object's LOCAL timezone, NOT UTC (which toISOString uses).
 */
import { formatLocalDate } from "@/lib/utils/date";

describe("formatLocalDate", () => {
  it("formats a regular date correctly", () => {
    const date = new Date(2026, 2, 24); // March 24, 2026
    expect(formatLocalDate(date)).toBe("2026-03-24");
  });

  it("pads single-digit month and day", () => {
    const date = new Date(2026, 0, 5); // Jan 5
    expect(formatLocalDate(date)).toBe("2026-01-05");
  });

  it("handles midnight (00:00) correctly — the toISOString danger zone", () => {
    const date = new Date(2026, 2, 24, 0, 0, 0, 0); // March 24, 00:00 local
    expect(formatLocalDate(date)).toBe("2026-03-24");
  });

  it("handles 00:30 — the problematic time in UTC+8", () => {
    // In UTC+8, 2026-03-24 00:30 = 2026-03-23 16:30 UTC
    // toISOString().split("T")[0] would return "2026-03-23" (WRONG)
    const date = new Date(2026, 2, 24, 0, 30, 0, 0);
    expect(formatLocalDate(date)).toBe("2026-03-24");
  });

  it("handles 23:59 — end of day", () => {
    const date = new Date(2026, 2, 24, 23, 59, 59, 999);
    expect(formatLocalDate(date)).toBe("2026-03-24");
  });

  it("handles year boundary — Dec 31 to Jan 1", () => {
    const dec31 = new Date(2026, 11, 31, 0, 0, 0, 0); // Dec 31, 2026
    expect(formatLocalDate(dec31)).toBe("2026-12-31");

    const jan1 = new Date(2027, 0, 1, 0, 0, 0, 0); // Jan 1, 2027
    expect(formatLocalDate(jan1)).toBe("2027-01-01");
  });

  it("handles month boundary — Jan 31 to Feb 1", () => {
    const jan31 = new Date(2026, 0, 31);
    expect(formatLocalDate(jan31)).toBe("2026-01-31");

    const feb1 = new Date(2026, 1, 1);
    expect(formatLocalDate(feb1)).toBe("2026-02-01");
  });

  it("handles leap year Feb 29", () => {
    const leapDay = new Date(2028, 1, 29); // 2028 is a leap year
    expect(formatLocalDate(leapDay)).toBe("2028-02-29");
  });

  it("handles month boundary — Feb 28 to Mar 1 (non-leap year)", () => {
    const feb28 = new Date(2026, 1, 28);
    expect(formatLocalDate(feb28)).toBe("2026-02-28");

    const mar1 = new Date(2026, 2, 1);
    expect(formatLocalDate(mar1)).toBe("2026-03-01");
  });
});
