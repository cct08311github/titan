// goal-validators tests cover the MonthlyGoal model standalone operations
import {
  createGoalSchema as createMonthlyGoalSchema,
  updateGoalSchema as updateMonthlyGoalSchema,
} from "../plan-validators";

describe("createMonthlyGoalSchema", () => {
  const validInput = {
    annualPlanId: "plan-abc",
    month: 3,
    title: "Q1 milestones",
  };

  test("accepts valid monthly goal input", () => {
    const result = createMonthlyGoalSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  test("accepts all 12 months", () => {
    for (let m = 1; m <= 12; m++) {
      const result = createMonthlyGoalSchema.safeParse({
        ...validInput,
        month: m,
      });
      expect(result.success).toBe(true);
    }
  });

  test("rejects missing annualPlanId", () => {
    const result = createMonthlyGoalSchema.safeParse({ month: 3, title: "T" });
    expect(result.success).toBe(false);
  });

  test("rejects month = 0", () => {
    const result = createMonthlyGoalSchema.safeParse({
      ...validInput,
      month: 0,
    });
    expect(result.success).toBe(false);
  });

  test("rejects month = 13", () => {
    const result = createMonthlyGoalSchema.safeParse({
      ...validInput,
      month: 13,
    });
    expect(result.success).toBe(false);
  });

  test("rejects empty title", () => {
    const result = createMonthlyGoalSchema.safeParse({
      ...validInput,
      title: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateMonthlyGoalSchema", () => {
  test("accepts partial update with only status", () => {
    const result = updateMonthlyGoalSchema.safeParse({ status: "IN_PROGRESS" });
    expect(result.success).toBe(true);
  });

  test("accepts all valid GoalStatus values", () => {
    const statuses = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
    for (const status of statuses) {
      const result = updateMonthlyGoalSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  test("accepts empty object", () => {
    const result = updateMonthlyGoalSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("rejects invalid status", () => {
    const result = updateMonthlyGoalSchema.safeParse({ status: "DONE" });
    expect(result.success).toBe(false);
  });

  test("rejects progressPct below 0", () => {
    const result = updateMonthlyGoalSchema.safeParse({ progressPct: -1 });
    expect(result.success).toBe(false);
  });

  test("rejects progressPct above 100", () => {
    const result = updateMonthlyGoalSchema.safeParse({ progressPct: 200 });
    expect(result.success).toBe(false);
  });
});
