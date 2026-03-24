import {
  createPlanSchema,
  updatePlanSchema,
  createGoalSchema,
  updateGoalSchema,
} from "../plan-validators";

describe("createPlanSchema", () => {
  const validInput = {
    year: 2026,
    title: "2026 Annual Plan",
  };

  test("accepts valid plan input", () => {
    const result = createPlanSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  test("accepts valid plan with optional fields", () => {
    const result = createPlanSchema.safeParse({
      ...validInput,
      description: "A description",
      implementationPlan: "## Plan\n- Step 1",
      copiedFromYear: 2025,
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing title", () => {
    const result = createPlanSchema.safeParse({ year: 2026 });
    expect(result.success).toBe(false);
  });

  test("rejects missing year", () => {
    const result = createPlanSchema.safeParse({ title: "Plan" });
    expect(result.success).toBe(false);
  });

  test("rejects non-integer year", () => {
    const result = createPlanSchema.safeParse({ year: 20.5, title: "Plan" });
    expect(result.success).toBe(false);
  });

  test("rejects year out of reasonable range", () => {
    const result = createPlanSchema.safeParse({ year: 1800, title: "Plan" });
    expect(result.success).toBe(false);
  });

  test("rejects empty title", () => {
    const result = createPlanSchema.safeParse({ year: 2026, title: "" });
    expect(result.success).toBe(false);
  });
});

describe("updatePlanSchema", () => {
  test("accepts partial update with only title", () => {
    const result = updatePlanSchema.safeParse({ title: "Updated Title" });
    expect(result.success).toBe(true);
  });

  test("accepts update with progressPct", () => {
    const result = updatePlanSchema.safeParse({ progressPct: 50 });
    expect(result.success).toBe(true);
  });

  test("accepts empty object", () => {
    const result = updatePlanSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("rejects progressPct out of range (> 100)", () => {
    const result = updatePlanSchema.safeParse({ progressPct: 150 });
    expect(result.success).toBe(false);
  });

  test("rejects progressPct out of range (< 0)", () => {
    const result = updatePlanSchema.safeParse({ progressPct: -5 });
    expect(result.success).toBe(false);
  });
});

describe("createGoalSchema", () => {
  const validInput = {
    annualPlanId: "plan-id-123",
    month: 6,
    title: "June deliverables",
  };

  test("accepts valid goal input", () => {
    const result = createGoalSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  test("accepts goal with optional description", () => {
    const result = createGoalSchema.safeParse({
      ...validInput,
      description: "June focus",
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing annualPlanId", () => {
    const { annualPlanId: _, ...rest } = validInput;
    const result = createGoalSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test("rejects month out of range (0)", () => {
    const result = createGoalSchema.safeParse({ ...validInput, month: 0 });
    expect(result.success).toBe(false);
  });

  test("rejects month out of range (13)", () => {
    const result = createGoalSchema.safeParse({ ...validInput, month: 13 });
    expect(result.success).toBe(false);
  });

  test("rejects missing title", () => {
    const { title: _, ...rest } = validInput;
    const result = createGoalSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

describe("updateGoalSchema", () => {
  test("accepts partial update with only title", () => {
    const result = updateGoalSchema.safeParse({ title: "New Title" });
    expect(result.success).toBe(true);
  });

  test("accepts update with valid status", () => {
    const result = updateGoalSchema.safeParse({ status: "COMPLETED" });
    expect(result.success).toBe(true);
  });

  test("accepts empty object", () => {
    const result = updateGoalSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("rejects invalid status enum", () => {
    const result = updateGoalSchema.safeParse({ status: "DONE" });
    expect(result.success).toBe(false);
  });

  test("rejects progressPct > 100", () => {
    const result = updateGoalSchema.safeParse({ progressPct: 101 });
    expect(result.success).toBe(false);
  });
});
