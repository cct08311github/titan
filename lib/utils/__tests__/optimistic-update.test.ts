import { calculatePosition } from "../optimistic-update";

describe("calculatePosition", () => {
  test("returns 0 when no neighbors", () => {
    expect(calculatePosition(null, null)).toBe(0);
  });

  test("returns midpoint between two positions", () => {
    expect(calculatePosition(100, 200)).toBe(150);
  });

  test("returns prev + 1000 when no next", () => {
    expect(calculatePosition(500, null)).toBe(1500);
  });

  test("returns next - 1000 when no prev", () => {
    expect(calculatePosition(null, 500)).toBe(-500);
  });

  test("handles negative positions", () => {
    expect(calculatePosition(-200, -100)).toBe(-150);
  });

  test("handles very close positions", () => {
    const result = calculatePosition(1.0, 1.1);
    expect(result).toBeCloseTo(1.05);
  });

  test("handles zero positions", () => {
    expect(calculatePosition(0, 1000)).toBe(500);
  });
});
