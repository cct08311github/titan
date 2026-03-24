import { createTimeEntrySchema, updateTimeEntrySchema } from "../time-entry-validators";

describe("createTimeEntrySchema", () => {
  const validInput = {
    date: "2026-03-15",
    hours: 8,
  };

  test("accepts valid time entry input", () => {
    const result = createTimeEntrySchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  test("accepts entry with all optional fields", () => {
    const result = createTimeEntrySchema.safeParse({
      ...validInput,
      taskId: "task-id-123",
      category: "PLANNED_TASK",
      description: "Worked on login feature",
    });
    expect(result.success).toBe(true);
  });

  test("accepts all valid TimeCategory values", () => {
    const categories = [
      "PLANNED_TASK",
      "ADDED_TASK",
      "INCIDENT",
      "SUPPORT",
      "ADMIN",
      "LEARNING",
    ];
    for (const category of categories) {
      const result = createTimeEntrySchema.safeParse({ ...validInput, category });
      expect(result.success).toBe(true);
    }
  });

  test("rejects missing date", () => {
    const result = createTimeEntrySchema.safeParse({ hours: 4 });
    expect(result.success).toBe(false);
  });

  test("rejects missing hours", () => {
    const result = createTimeEntrySchema.safeParse({ date: "2026-03-15" });
    expect(result.success).toBe(false);
  });

  test("rejects negative hours", () => {
    const result = createTimeEntrySchema.safeParse({ ...validInput, hours: -1 });
    expect(result.success).toBe(false);
  });

  test("rejects hours exceeding 24", () => {
    const result = createTimeEntrySchema.safeParse({ ...validInput, hours: 25 });
    expect(result.success).toBe(false);
  });

  test("rejects invalid date string", () => {
    const result = createTimeEntrySchema.safeParse({ ...validInput, date: "not-a-date" });
    expect(result.success).toBe(false);
  });

  test("rejects invalid category", () => {
    const result = createTimeEntrySchema.safeParse({
      ...validInput,
      category: "OVERTIME",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateTimeEntrySchema", () => {
  test("accepts partial update with only hours", () => {
    const result = updateTimeEntrySchema.safeParse({ hours: 6 });
    expect(result.success).toBe(true);
  });

  test("accepts partial update with only category", () => {
    const result = updateTimeEntrySchema.safeParse({ category: "SUPPORT" });
    expect(result.success).toBe(true);
  });

  test("accepts empty object", () => {
    const result = updateTimeEntrySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("rejects negative hours in update", () => {
    const result = updateTimeEntrySchema.safeParse({ hours: -2 });
    expect(result.success).toBe(false);
  });

  test("rejects hours > 24 in update", () => {
    const result = updateTimeEntrySchema.safeParse({ hours: 30 });
    expect(result.success).toBe(false);
  });

  test("rejects invalid category in update", () => {
    const result = updateTimeEntrySchema.safeParse({ category: "INVALID" });
    expect(result.success).toBe(false);
  });
});
