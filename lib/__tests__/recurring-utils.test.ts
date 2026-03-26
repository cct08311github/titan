/**
 * @jest-environment node
 */
import {
  calculateNextDueAt,
  resolveTitle,
  shouldGenerate,
} from "@/lib/recurring-utils";

describe("recurring-utils", () => {
  describe("calculateNextDueAt", () => {
    const base = new Date("2026-03-26T10:00:00");

    it("DAILY: returns next day at specified time", () => {
      const next = calculateNextDueAt(
        { frequency: "DAILY", timeOfDay: "08:00" },
        base
      );
      expect(next.getFullYear()).toBe(2026);
      expect(next.getMonth()).toBe(2); // March
      expect(next.getDate()).toBe(27);
      expect(next.getHours()).toBe(8);
      expect(next.getMinutes()).toBe(0);
    });

    it("WEEKLY: returns next occurrence of target day", () => {
      // 2026-03-26 is Thursday (day=4), target Monday (day=1)
      const next = calculateNextDueAt(
        { frequency: "WEEKLY", dayOfWeek: 1, timeOfDay: "09:00" },
        base
      );
      expect(next.getDay()).toBe(1); // Monday
      expect(next.getHours()).toBe(9);
      // Should be March 30 (next Monday)
      expect(next.getDate()).toBe(30);
    });

    it("WEEKLY dayOfWeek=1: does not generate on non-Monday", () => {
      // Base is Thursday, next occurrence is Monday
      const next = calculateNextDueAt(
        { frequency: "WEEKLY", dayOfWeek: 1 },
        base
      );
      expect(next.getDay()).toBe(1);
      expect(next > base).toBe(true);
    });

    it("MONTHLY: returns next month at specified day", () => {
      const next = calculateNextDueAt(
        { frequency: "MONTHLY", dayOfMonth: 15, timeOfDay: "08:00" },
        base
      );
      expect(next.getMonth()).toBe(3); // April
      expect(next.getDate()).toBe(15);
    });

    it("MONTHLY dayOfMonth=31: clamps to last day of short month", () => {
      // After March, next month is April which has 30 days
      const next = calculateNextDueAt(
        { frequency: "MONTHLY", dayOfMonth: 31 },
        base
      );
      expect(next.getMonth()).toBe(3); // April
      expect(next.getDate()).toBe(30); // April has 30 days
    });

    it("MONTHLY dayOfMonth=31: clamps February to 28/29", () => {
      const janBase = new Date("2026-01-15T10:00:00");
      const next = calculateNextDueAt(
        { frequency: "MONTHLY", dayOfMonth: 31 },
        janBase
      );
      expect(next.getMonth()).toBe(1); // February
      expect(next.getDate()).toBe(28); // 2026 is not a leap year
    });

    it("QUARTERLY: returns next quarter occurrence", () => {
      const next = calculateNextDueAt(
        { frequency: "QUARTERLY", monthOfYear: 1, dayOfMonth: 15, timeOfDay: "08:00" },
        base
      );
      // After March 26, next quarterly month starting with Jan pattern (1, 4, 7, 10)
      // April 15 should be next
      expect(next > base).toBe(true);
      expect(next.getHours()).toBe(8);
    });

    it("YEARLY: returns next year if this year already passed", () => {
      const next = calculateNextDueAt(
        { frequency: "YEARLY", monthOfYear: 1, dayOfMonth: 15 },
        base
      );
      // Jan 15 already passed in 2026, so next is Jan 15 2027
      expect(next.getFullYear()).toBe(2027);
      expect(next.getMonth()).toBe(0);
      expect(next.getDate()).toBe(15);
    });

    it("YEARLY: returns this year if not yet passed", () => {
      const next = calculateNextDueAt(
        { frequency: "YEARLY", monthOfYear: 12, dayOfMonth: 25 },
        base
      );
      expect(next.getFullYear()).toBe(2026);
      expect(next.getMonth()).toBe(11); // December
      expect(next.getDate()).toBe(25);
    });

    it("BIWEEKLY: returns target day + 1 week", () => {
      const next = calculateNextDueAt(
        { frequency: "BIWEEKLY", dayOfWeek: 1, timeOfDay: "08:00" },
        base
      );
      expect(next.getDay()).toBe(1); // Monday
      // Next Monday after March 26 is March 30, biweekly adds 7 days = April 6
      expect(next.getDate()).toBe(6);
      expect(next.getMonth()).toBe(3); // April
    });

    it("handles cross-year schedule (Dec → Jan)", () => {
      const decBase = new Date("2026-12-20T10:00:00");
      const next = calculateNextDueAt(
        { frequency: "MONTHLY", dayOfMonth: 5, timeOfDay: "08:00" },
        decBase
      );
      expect(next.getFullYear()).toBe(2027);
      expect(next.getMonth()).toBe(0); // January
      expect(next.getDate()).toBe(5);
    });
  });

  describe("resolveTitle", () => {
    it("replaces {date} with formatted date", () => {
      const date = new Date("2026-03-28T08:00:00");
      expect(resolveTitle("每日巡檢 — {date}", date)).toBe("每日巡檢 — 2026/03/28");
    });

    it("handles multiple {date} placeholders", () => {
      const date = new Date("2026-01-05T08:00:00");
      expect(resolveTitle("{date} 巡檢 {date}", date)).toBe("2026/01/05 巡檢 2026/01/05");
    });

    it("returns original if no placeholder", () => {
      const date = new Date("2026-03-28T08:00:00");
      expect(resolveTitle("固定標題", date)).toBe("固定標題");
    });
  });

  describe("shouldGenerate", () => {
    const now = new Date("2026-03-26T10:00:00");

    it("returns true when active and nextDueAt <= now", () => {
      expect(
        shouldGenerate(
          { isActive: true, nextDueAt: new Date("2026-03-26T08:00:00") },
          now
        )
      ).toBe(true);
    });

    it("returns false when inactive", () => {
      expect(
        shouldGenerate(
          { isActive: false, nextDueAt: new Date("2026-03-26T08:00:00") },
          now
        )
      ).toBe(false);
    });

    it("returns false when nextDueAt is in the future", () => {
      expect(
        shouldGenerate(
          { isActive: true, nextDueAt: new Date("2026-03-27T08:00:00") },
          now
        )
      ).toBe(false);
    });

    it("returns false when nextDueAt is null", () => {
      expect(
        shouldGenerate({ isActive: true, nextDueAt: null }, now)
      ).toBe(false);
    });
  });
});
