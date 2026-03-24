import {
  createDeliverableSchema,
  updateDeliverableSchema,
  listDeliverablesSchema,
} from "../deliverable-validators";

describe("createDeliverableSchema", () => {
  const validInput = {
    title: "Q1 Report",
    type: "REPORT",
  };

  test("accepts valid deliverable with required fields only", () => {
    const result = createDeliverableSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  test("accepts all valid type values", () => {
    for (const type of ["DOCUMENT", "SYSTEM", "REPORT", "APPROVAL"]) {
      const result = createDeliverableSchema.safeParse({ ...validInput, type });
      expect(result.success).toBe(true);
    }
  });

  test("accepts optional taskId", () => {
    const result = createDeliverableSchema.safeParse({ ...validInput, taskId: "task-123" });
    expect(result.success).toBe(true);
  });

  test("accepts optional kpiId", () => {
    const result = createDeliverableSchema.safeParse({ ...validInput, kpiId: "kpi-123" });
    expect(result.success).toBe(true);
  });

  test("accepts optional annualPlanId", () => {
    const result = createDeliverableSchema.safeParse({ ...validInput, annualPlanId: "plan-123" });
    expect(result.success).toBe(true);
  });

  test("accepts optional monthlyGoalId", () => {
    const result = createDeliverableSchema.safeParse({ ...validInput, monthlyGoalId: "goal-123" });
    expect(result.success).toBe(true);
  });

  test("accepts valid attachmentUrl", () => {
    const result = createDeliverableSchema.safeParse({
      ...validInput,
      attachmentUrl: "https://example.com/file.pdf",
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing title", () => {
    const result = createDeliverableSchema.safeParse({ type: "REPORT" });
    expect(result.success).toBe(false);
  });

  test("rejects empty title", () => {
    const result = createDeliverableSchema.safeParse({ ...validInput, title: "" });
    expect(result.success).toBe(false);
  });

  test("rejects missing type", () => {
    const result = createDeliverableSchema.safeParse({ title: "My deliverable" });
    expect(result.success).toBe(false);
  });

  test("rejects invalid type enum", () => {
    const result = createDeliverableSchema.safeParse({ ...validInput, type: "INVALID" });
    expect(result.success).toBe(false);
  });

  test("rejects invalid attachmentUrl (not a URL)", () => {
    const result = createDeliverableSchema.safeParse({
      ...validInput,
      attachmentUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateDeliverableSchema", () => {
  test("accepts empty object (all fields optional)", () => {
    const result = updateDeliverableSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("accepts partial update with only title", () => {
    const result = updateDeliverableSchema.safeParse({ title: "Updated Title" });
    expect(result.success).toBe(true);
  });

  test("accepts valid status values", () => {
    for (const status of ["NOT_STARTED", "IN_PROGRESS", "DELIVERED", "ACCEPTED"]) {
      const result = updateDeliverableSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  test("rejects invalid status enum", () => {
    const result = updateDeliverableSchema.safeParse({ status: "DONE" });
    expect(result.success).toBe(false);
  });

  test("accepts null attachmentUrl (clearing the URL)", () => {
    const result = updateDeliverableSchema.safeParse({ attachmentUrl: null });
    expect(result.success).toBe(true);
  });

  test("rejects empty title string", () => {
    const result = updateDeliverableSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  test("accepts valid attachmentUrl", () => {
    const result = updateDeliverableSchema.safeParse({
      attachmentUrl: "https://storage.example.com/file.docx",
    });
    expect(result.success).toBe(true);
  });

  test("rejects invalid attachmentUrl when provided", () => {
    const result = updateDeliverableSchema.safeParse({ attachmentUrl: "bad-url" });
    expect(result.success).toBe(false);
  });

  test("accepts null acceptedBy", () => {
    const result = updateDeliverableSchema.safeParse({ acceptedBy: null });
    expect(result.success).toBe(true);
  });

  test("accepts null acceptedAt", () => {
    const result = updateDeliverableSchema.safeParse({ acceptedAt: null });
    expect(result.success).toBe(true);
  });

  test("accepts valid datetime string for acceptedAt", () => {
    const result = updateDeliverableSchema.safeParse({
      acceptedAt: "2024-06-15T10:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  test("rejects invalid datetime string for acceptedAt", () => {
    const result = updateDeliverableSchema.safeParse({ acceptedAt: "not-a-date" });
    expect(result.success).toBe(false);
  });
});

describe("listDeliverablesSchema", () => {
  test("accepts empty query (all filters optional)", () => {
    const result = listDeliverablesSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("accepts valid taskId filter", () => {
    const result = listDeliverablesSchema.safeParse({ taskId: "task-abc" });
    expect(result.success).toBe(true);
  });

  test("accepts valid kpiId filter", () => {
    const result = listDeliverablesSchema.safeParse({ kpiId: "kpi-xyz" });
    expect(result.success).toBe(true);
  });

  test("accepts valid annualPlanId filter", () => {
    const result = listDeliverablesSchema.safeParse({ annualPlanId: "plan-1" });
    expect(result.success).toBe(true);
  });

  test("accepts valid monthlyGoalId filter", () => {
    const result = listDeliverablesSchema.safeParse({ monthlyGoalId: "goal-1" });
    expect(result.success).toBe(true);
  });

  test("accepts valid status filter", () => {
    for (const status of ["NOT_STARTED", "IN_PROGRESS", "DELIVERED", "ACCEPTED"]) {
      const result = listDeliverablesSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  test("accepts valid type filter", () => {
    for (const type of ["DOCUMENT", "SYSTEM", "REPORT", "APPROVAL"]) {
      const result = listDeliverablesSchema.safeParse({ type });
      expect(result.success).toBe(true);
    }
  });

  test("rejects invalid status filter", () => {
    const result = listDeliverablesSchema.safeParse({ status: "INVALID" });
    expect(result.success).toBe(false);
  });

  test("rejects invalid type filter", () => {
    const result = listDeliverablesSchema.safeParse({ type: "INVALID_TYPE" });
    expect(result.success).toBe(false);
  });

  test("accepts combined filters", () => {
    const result = listDeliverablesSchema.safeParse({
      annualPlanId: "plan-1",
      status: "IN_PROGRESS",
      type: "DOCUMENT",
    });
    expect(result.success).toBe(true);
  });
});
