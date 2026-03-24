import {
  createMilestoneSchema,
  updateMilestoneSchema,
} from "../milestone-validators";

describe("createMilestoneSchema", () => {
  const validInput = {
    annualPlanId: "plan-abc",
    title: "Q1 Launch",
    plannedEnd: "2025-03-31T00:00:00.000Z",
  };

  test("accepts valid input", () => {
    const result = createMilestoneSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  test("accepts valid input with optional fields", () => {
    const result = createMilestoneSchema.safeParse({
      ...validInput,
      description: "Launch milestone for Q1",
      plannedStart: "2025-01-01T00:00:00.000Z",
      order: 1,
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing title", () => {
    const result = createMilestoneSchema.safeParse({
      annualPlanId: "plan-abc",
      plannedEnd: "2025-03-31T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing annualPlanId", () => {
    const result = createMilestoneSchema.safeParse({
      title: "Q1 Launch",
      plannedEnd: "2025-03-31T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid dates", () => {
    const result = createMilestoneSchema.safeParse({
      ...validInput,
      plannedEnd: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  test("rejects plannedEnd before plannedStart", () => {
    const result = createMilestoneSchema.safeParse({
      ...validInput,
      plannedStart: "2025-04-01T00:00:00.000Z",
      plannedEnd: "2025-03-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateMilestoneSchema", () => {
  test("accepts empty object", () => {
    const result = updateMilestoneSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("accepts partial update with title only", () => {
    const result = updateMilestoneSchema.safeParse({ title: "Updated Title" });
    expect(result.success).toBe(true);
  });

  test("accepts valid status values", () => {
    const statuses = ["PENDING", "IN_PROGRESS", "COMPLETED", "DELAYED", "CANCELLED"];
    for (const status of statuses) {
      const result = updateMilestoneSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  test("rejects invalid status", () => {
    const result = updateMilestoneSchema.safeParse({ status: "UNKNOWN" });
    expect(result.success).toBe(false);
  });

  test("rejects invalid date string", () => {
    const result = updateMilestoneSchema.safeParse({ actualStart: "not-a-date" });
    expect(result.success).toBe(false);
  });
});
