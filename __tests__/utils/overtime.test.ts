/**
 * Tests for lib/overtime.ts — monthly overtime calculation & thresholds
 */
import {
  OVERTIME_CONFIG,
  getWorkingDaysInMonth,
  calculateMonthlyOvertime,
  getOvertimeLevel,
  getOvertimeInfo,
} from "@/lib/overtime";

describe("getWorkingDaysInMonth", () => {
  it("calculates working days for March 2026 (22 working days)", () => {
    // March 2026: starts on Sunday, 31 days
    // Weekends: 1,7,8,14,15,21,22,28,29 = 9 weekend days
    // Working days: 31 - 9 = 22
    expect(getWorkingDaysInMonth(2026, 2)).toBe(22);
  });

  it("calculates working days for February 2026 (20 working days)", () => {
    // Feb 2026: starts on Sunday, 28 days
    // Weekends: 1,7,8,14,15,21,22,28 = 8 weekend days
    // Working days: 28 - 8 = 20
    expect(getWorkingDaysInMonth(2026, 1)).toBe(20);
  });

  it("calculates working days for February 2028 — leap year (21 working days)", () => {
    // Feb 2028: starts on Tuesday, 29 days
    // Weekdays: Mon-Fri covers well
    expect(getWorkingDaysInMonth(2028, 1)).toBe(21);
  });

  it("calculates working days for April 2026 (22 working days)", () => {
    // April 2026: starts on Wednesday, 30 days
    expect(getWorkingDaysInMonth(2026, 3)).toBe(22);
  });
});

describe("calculateMonthlyOvertime", () => {
  it("returns 0 when total hours are below base hours", () => {
    // March 2026: 22 working days × 8h = 176h base
    expect(calculateMonthlyOvertime(160, 2026, 2)).toBe(0);
  });

  it("returns 0 when total hours equal base hours", () => {
    // March 2026: 22 × 8 = 176h
    expect(calculateMonthlyOvertime(176, 2026, 2)).toBe(0);
  });

  it("returns overtime when exceeding base hours", () => {
    // 176h base + 20h overtime = 196h
    expect(calculateMonthlyOvertime(196, 2026, 2)).toBe(20);
  });

  it("calculates overtime for short month (February 2026, 20 working days)", () => {
    // Feb 2026: 20 × 8 = 160h base
    // 180h total → 20h overtime
    expect(calculateMonthlyOvertime(180, 2026, 1)).toBe(20);
  });

  it("returns 0 for zero hours", () => {
    expect(calculateMonthlyOvertime(0, 2026, 2)).toBe(0);
  });
});

describe("getOvertimeLevel", () => {
  it("returns 'safe' when below warning threshold", () => {
    expect(getOvertimeLevel(0)).toBe("safe");
    expect(getOvertimeLevel(10)).toBe("safe");
    expect(getOvertimeLevel(35)).toBe("safe");
    expect(getOvertimeLevel(35.9)).toBe("safe");
  });

  it("returns 'warning' at exactly the warning threshold (36h)", () => {
    expect(getOvertimeLevel(OVERTIME_CONFIG.WARNING_THRESHOLD)).toBe("warning");
  });

  it("returns 'warning' between 36 and 46h", () => {
    expect(getOvertimeLevel(40)).toBe("warning");
    expect(getOvertimeLevel(46)).toBe("warning");
  });

  it("returns 'danger' above limit (> 46h)", () => {
    expect(getOvertimeLevel(46.1)).toBe("danger");
    expect(getOvertimeLevel(50)).toBe("danger");
    expect(getOvertimeLevel(54)).toBe("danger");
  });
});

describe("getOvertimeInfo", () => {
  it("returns complete info for zero overtime", () => {
    const info = getOvertimeInfo(100, 2026, 2); // well below 176h base
    expect(info.overtimeHours).toBe(0);
    expect(info.level).toBe("safe");
    expect(info.limit).toBe(46);
  });

  it("returns warning level at threshold", () => {
    // 176h base + 36h overtime = 212h
    const info = getOvertimeInfo(212, 2026, 2);
    expect(info.overtimeHours).toBe(36);
    expect(info.level).toBe("warning");
  });

  it("returns danger level above limit", () => {
    // 176h base + 50h overtime = 226h
    const info = getOvertimeInfo(226, 2026, 2);
    expect(info.overtimeHours).toBe(50);
    expect(info.level).toBe("danger");
  });
});
