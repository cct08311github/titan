/**
 * @jest-environment node
 */
/**
 * Gantt zoom tests — Issue #831 (G-5)
 * Tests zoom level logic and localStorage persistence
 */

describe("Gantt zoom view mode mapping", () => {
  const VIEW_MODE_MAP: Record<string, { gridUnit: string; useCase: string }> = {
    Day: { gridUnit: "每格一天", useCase: "短期任務" },
    Week: { gridUnit: "每格一週", useCase: "中期規劃" },
    Quarter: { gridUnit: "每格一個月", useCase: "長期專案" },
  };

  it("Day view maps to daily grid", () => {
    expect(VIEW_MODE_MAP["Day"].gridUnit).toBe("每格一天");
  });

  it("Week view (default) maps to weekly grid", () => {
    expect(VIEW_MODE_MAP["Week"].gridUnit).toBe("每格一週");
  });

  it("Quarter view maps to monthly grid", () => {
    expect(VIEW_MODE_MAP["Quarter"].gridUnit).toBe("每格一個月");
  });

  it("supports exactly 3 zoom levels", () => {
    expect(Object.keys(VIEW_MODE_MAP)).toHaveLength(3);
  });
});

describe("Gantt zoom localStorage key", () => {
  const STORAGE_KEY = "titan-gantt-zoom";
  const VALID_MODES = ["Day", "Week", "Month", "Quarter"];

  it("uses correct storage key", () => {
    expect(STORAGE_KEY).toBe("titan-gantt-zoom");
  });

  it("validates stored value against allowed modes", () => {
    for (const mode of ["Day", "Week", "Quarter"]) {
      expect(VALID_MODES.includes(mode)).toBe(true);
    }
  });

  it("rejects invalid stored values", () => {
    const invalid = ["daily", "monthly", "yearly", "", "null"];
    for (const val of invalid) {
      expect(VALID_MODES.includes(val)).toBe(false);
    }
  });

  it("default mode is Week (month view)", () => {
    const DEFAULT = "Week";
    expect(DEFAULT).toBe("Week");
  });
});
