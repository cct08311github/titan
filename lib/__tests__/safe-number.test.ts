/**
 * @jest-environment node
 *
 * TDD tests for safe-number utilities — Issue #175
 * Covers: safeFixed, safeLocaleString, safeNum, safePct
 */

import { safeFixed, safeLocaleString, safeNum, safePct } from "@/lib/safe-number";

describe("safeFixed", () => {
  test("formats valid number", () => {
    expect(safeFixed(3.14159, 2)).toBe("3.14");
    expect(safeFixed(42, 1)).toBe("42.0");
    expect(safeFixed(0, 1)).toBe("0.0");
  });

  test("handles negative numbers", () => {
    expect(safeFixed(-5.678, 2)).toBe("-5.68");
  });

  test("returns fallback for null", () => {
    expect(safeFixed(null)).toBe("0");
  });

  test("returns fallback for undefined", () => {
    expect(safeFixed(undefined)).toBe("0");
  });

  test("returns fallback for NaN", () => {
    expect(safeFixed(NaN)).toBe("0");
  });

  test("returns fallback for Infinity", () => {
    expect(safeFixed(Infinity)).toBe("0");
    expect(safeFixed(-Infinity)).toBe("0");
  });

  test("returns fallback for non-numeric string", () => {
    expect(safeFixed("hello")).toBe("0");
  });

  test("parses numeric string (consistent with safeNum)", () => {
    expect(safeFixed("123", 1)).toBe("123.0");
    expect(safeFixed("3.14", 2)).toBe("3.14");
  });

  test("returns fallback for boolean", () => {
    expect(safeFixed(true)).toBe("0");
    expect(safeFixed(false)).toBe("0");
  });

  test("returns fallback for object/array", () => {
    expect(safeFixed({})).toBe("0");
    expect(safeFixed([])).toBe("0");
  });

  test("uses custom fallback", () => {
    expect(safeFixed(null, 1, "—")).toBe("—");
    expect(safeFixed(undefined, 1, "N/A")).toBe("N/A");
  });

  test("handles very large numbers", () => {
    expect(safeFixed(Number.MAX_SAFE_INTEGER, 0)).toBe("9007199254740991");
  });

  test("handles very small numbers", () => {
    expect(safeFixed(0.000001, 6)).toBe("0.000001");
  });
});

describe("safeLocaleString", () => {
  test("formats valid number", () => {
    const result = safeLocaleString(1234567.89);
    expect(result).toContain("1,234,567"); // locale-dependent separator
  });

  test("returns fallback for null/undefined/NaN", () => {
    expect(safeLocaleString(null)).toBe("0");
    expect(safeLocaleString(undefined)).toBe("0");
    expect(safeLocaleString(NaN)).toBe("0");
  });

  test("uses custom fallback", () => {
    expect(safeLocaleString(null, "zh-TW", undefined, "—")).toBe("—");
  });
});

describe("safeNum", () => {
  test("passes through valid numbers", () => {
    expect(safeNum(42)).toBe(42);
    expect(safeNum(0)).toBe(0);
    expect(safeNum(-5.5)).toBe(-5.5);
  });

  test("parses numeric strings", () => {
    expect(safeNum("123")).toBe(123);
    expect(safeNum("3.14")).toBe(3.14);
  });

  test("returns fallback for non-numeric strings", () => {
    expect(safeNum("hello")).toBe(0);
    expect(safeNum("")).toBe(0);
  });

  test("returns fallback for null/undefined/NaN/Infinity", () => {
    expect(safeNum(null)).toBe(0);
    expect(safeNum(undefined)).toBe(0);
    expect(safeNum(NaN)).toBe(0);
    expect(safeNum(Infinity)).toBe(0);
  });

  test("uses custom fallback", () => {
    expect(safeNum(null, -1)).toBe(-1);
  });

  test("returns fallback for whitespace-only strings", () => {
    expect(safeNum("  ")).toBe(0);
    expect(safeNum("\t\n")).toBe(0);
  });
});

describe("safePct", () => {
  test("formats valid percentage", () => {
    expect(safePct(75.5, 1)).toBe("75.5");
    expect(safePct(100, 0)).toBe("100");
    expect(safePct(0, 0)).toBe("0");
  });

  test("clamps to 0-100 range by default", () => {
    expect(safePct(150, 0)).toBe("100");
    expect(safePct(-20, 0)).toBe("0");
  });

  test("allows overflow when specified", () => {
    expect(safePct(150, 0, "0", true)).toBe("150");
    expect(safePct(-20, 0, "0", true)).toBe("-20");
  });

  test("returns fallback for null/undefined/NaN", () => {
    expect(safePct(null)).toBe("0");
    expect(safePct(undefined)).toBe("0");
    expect(safePct(NaN)).toBe("0");
  });

  test("uses custom fallback", () => {
    expect(safePct(null, 0, "—")).toBe("—");
  });
});
