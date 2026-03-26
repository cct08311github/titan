/**
 * @jest-environment node
 */
/**
 * Issue #818 — Progress auto-calculation tests
 */
import { calculatePlanProgress, progressDisplay } from "@/lib/progress-calc";

describe("calculatePlanProgress", () => {
  it("returns 0 for empty goals array", () => {
    expect(calculatePlanProgress([])).toBe(0);
  });

  it("returns 100 when all goals completed", () => {
    const goals = [
      { status: "COMPLETED" },
      { status: "COMPLETED" },
      { status: "COMPLETED" },
    ];
    expect(calculatePlanProgress(goals)).toBe(100);
  });

  it("returns 0 when no goals completed", () => {
    const goals = [
      { status: "NOT_STARTED" },
      { status: "IN_PROGRESS" },
    ];
    expect(calculatePlanProgress(goals)).toBe(0);
  });

  it("calculates correct percentage with mixed statuses", () => {
    const goals = [
      { status: "COMPLETED" },
      { status: "NOT_STARTED" },
      { status: "IN_PROGRESS" },
    ];
    expect(calculatePlanProgress(goals)).toBe(33); // 1/3 = 33.33 -> 33
  });

  it("rounds to nearest integer", () => {
    const goals = [
      { status: "COMPLETED" },
      { status: "COMPLETED" },
      { status: "NOT_STARTED" },
    ];
    expect(calculatePlanProgress(goals)).toBe(67); // 2/3 = 66.67 -> 67
  });

  it("handles single completed goal", () => {
    expect(calculatePlanProgress([{ status: "COMPLETED" }])).toBe(100);
  });

  it("handles single non-completed goal", () => {
    expect(calculatePlanProgress([{ status: "IN_PROGRESS" }])).toBe(0);
  });

  it("handles CANCELLED goals as non-completed", () => {
    const goals = [
      { status: "COMPLETED" },
      { status: "CANCELLED" },
    ];
    expect(calculatePlanProgress(goals)).toBe(50);
  });
});

describe("progressDisplay", () => {
  it("returns '未設定目標' for empty goals", () => {
    expect(progressDisplay([])).toBe("未設定目標");
  });

  it("returns percentage string for goals", () => {
    expect(progressDisplay([{ status: "COMPLETED" }])).toBe("100%");
  });

  it("returns '0%' for non-completed goals", () => {
    expect(progressDisplay([{ status: "NOT_STARTED" }])).toBe("0%");
  });
});
