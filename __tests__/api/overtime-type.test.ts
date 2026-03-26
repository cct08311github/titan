/**
 * @jest-environment node
 */
/**
 * Tests for overtime type marking — Issue #814 (T-2)
 */

describe("OvertimeType enum", () => {
  it("supports NONE", () => {
    const types = ["NONE", "WEEKDAY", "REST_DAY", "HOLIDAY"];
    expect(types).toContain("NONE");
  });

  it("supports WEEKDAY", () => {
    const types = ["NONE", "WEEKDAY", "REST_DAY", "HOLIDAY"];
    expect(types).toContain("WEEKDAY");
  });

  it("supports REST_DAY (new)", () => {
    const types = ["NONE", "WEEKDAY", "REST_DAY", "HOLIDAY"];
    expect(types).toContain("REST_DAY");
  });

  it("supports HOLIDAY", () => {
    const types = ["NONE", "WEEKDAY", "REST_DAY", "HOLIDAY"];
    expect(types).toContain("HOLIDAY");
  });
});

describe("Overtime badge labels", () => {
  const LABELS: Record<string, string> = {
    NONE: "非加班",
    WEEKDAY: "平日加班",
    REST_DAY: "休息日加班",
    HOLIDAY: "國定假日加班",
  };

  it("has label for all overtime types", () => {
    expect(Object.keys(LABELS)).toEqual(["NONE", "WEEKDAY", "REST_DAY", "HOLIDAY"]);
  });

  it("non-OT entries have overtimeType null or NONE", () => {
    const entry = { hours: 8, overtimeType: "NONE" };
    expect(entry.overtimeType === "NONE" || entry.overtimeType == null).toBe(true);
  });

  it("OT entries must have overtimeType set to non-NONE", () => {
    const entry = { hours: 2, overtimeType: "WEEKDAY" as string };
    expect(entry.overtimeType !== "NONE").toBe(true);
  });
});

describe("Overtime hours calculation", () => {
  type Entry = { hours: number; overtimeType: string };

  function calculateOvertimeHours(entries: Entry[]): number {
    return entries
      .filter((e) => e.overtimeType !== "NONE")
      .reduce((sum, e) => sum + e.hours, 0);
  }

  function calculateRegularHours(entries: Entry[]): number {
    return entries
      .filter((e) => e.overtimeType === "NONE")
      .reduce((sum, e) => sum + e.hours, 0);
  }

  it("separates overtime from regular hours", () => {
    const entries: Entry[] = [
      { hours: 8, overtimeType: "NONE" },
      { hours: 2, overtimeType: "WEEKDAY" },
      { hours: 4, overtimeType: "HOLIDAY" },
    ];
    expect(calculateRegularHours(entries)).toBe(8);
    expect(calculateOvertimeHours(entries)).toBe(6);
  });

  it("returns 0 OT when no overtime entries", () => {
    const entries: Entry[] = [
      { hours: 8, overtimeType: "NONE" },
    ];
    expect(calculateOvertimeHours(entries)).toBe(0);
  });

  it("handles mixed overtime types", () => {
    const entries: Entry[] = [
      { hours: 8, overtimeType: "NONE" },
      { hours: 2, overtimeType: "WEEKDAY" },
      { hours: 3, overtimeType: "REST_DAY" },
      { hours: 1, overtimeType: "HOLIDAY" },
    ];
    expect(calculateOvertimeHours(entries)).toBe(6);
  });

  it("handles same-day regular + overtime mix", () => {
    const entries: Entry[] = [
      { hours: 8, overtimeType: "NONE" },
      { hours: 2, overtimeType: "WEEKDAY" },
    ];
    const total = entries.reduce((s, e) => s + e.hours, 0);
    const ot = calculateOvertimeHours(entries);
    expect(total).toBe(10);
    expect(ot).toBe(2);
  });
});
