import { createKpiSchema, updateKpiSchema, createKpiAchievementSchema } from "../kpi-validators";

describe("createKpiSchema", () => {
  const validInput = {
    year: 2026,
    code: "KPI-2026-01",
    title: "Customer Satisfaction",
    target: 95.0,
  };

  test("accepts valid KPI input", () => {
    const result = createKpiSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  test("accepts KPI with all optional fields", () => {
    const result = createKpiSchema.safeParse({
      ...validInput,
      description: "NPS score target",
      measureMethod: "Monthly NPS survey",
      weight: 20,
      frequency: "MONTHLY",
      minValue: 0,
      maxValue: 100,
      unit: "%",
      visibility: "ALL",
      autoCalc: true,
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing year", () => {
    const { year: _, ...rest } = validInput;
    const result = createKpiSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test("rejects missing code", () => {
    const { code: _, ...rest } = validInput;
    const result = createKpiSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test("rejects missing title", () => {
    const { title: _, ...rest } = validInput;
    const result = createKpiSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test("rejects missing target", () => {
    const { target: _, ...rest } = validInput;
    const result = createKpiSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test("rejects negative target", () => {
    const result = createKpiSchema.safeParse({ ...validInput, target: -1 });
    expect(result.success).toBe(false);
  });

  test("rejects non-integer year", () => {
    const result = createKpiSchema.safeParse({ ...validInput, year: 2026.5 });
    expect(result.success).toBe(false);
  });

  test("rejects empty code", () => {
    const result = createKpiSchema.safeParse({ ...validInput, code: "" });
    expect(result.success).toBe(false);
  });

  test("rejects weight > 100", () => {
    const result = createKpiSchema.safeParse({ ...validInput, weight: 101 });
    expect(result.success).toBe(false);
  });

  test("rejects weight < 0", () => {
    const result = createKpiSchema.safeParse({ ...validInput, weight: -1 });
    expect(result.success).toBe(false);
  });

  test("rejects invalid frequency", () => {
    const result = createKpiSchema.safeParse({ ...validInput, frequency: "WEEKLY" });
    expect(result.success).toBe(false);
  });

  test("rejects invalid visibility", () => {
    const result = createKpiSchema.safeParse({ ...validInput, visibility: "PRIVATE" });
    expect(result.success).toBe(false);
  });

  test("rejects minValue > maxValue", () => {
    const result = createKpiSchema.safeParse({ ...validInput, minValue: 100, maxValue: 50 });
    expect(result.success).toBe(false);
  });

  test("rejects target outside value range", () => {
    const result = createKpiSchema.safeParse({
      ...validInput, target: 200, minValue: 0, maxValue: 100,
    });
    expect(result.success).toBe(false);
  });

  test("accepts valid frequency values", () => {
    for (const frequency of ["MONTHLY", "QUARTERLY", "YEARLY"]) {
      const result = createKpiSchema.safeParse({ ...validInput, frequency });
      expect(result.success).toBe(true);
    }
  });

  test("accepts valid visibility values", () => {
    for (const visibility of ["ALL", "MANAGER"]) {
      const result = createKpiSchema.safeParse({ ...validInput, visibility });
      expect(result.success).toBe(true);
    }
  });
});

describe("updateKpiSchema", () => {
  test("accepts partial update with only title", () => {
    const result = updateKpiSchema.safeParse({ title: "New Title" });
    expect(result.success).toBe(true);
  });

  test("accepts update with valid status", () => {
    const result = updateKpiSchema.safeParse({ status: "ACHIEVED" });
    expect(result.success).toBe(true);
  });

  test("accepts all valid KPIStatus values", () => {
    const statuses = ["DRAFT", "ACTIVE", "ACHIEVED", "MISSED", "CANCELLED"];
    for (const status of statuses) {
      const result = updateKpiSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  test("accepts update with new fields", () => {
    const result = updateKpiSchema.safeParse({
      frequency: "QUARTERLY",
      visibility: "MANAGER",
      measureMethod: "Updated method",
      unit: "hours",
    });
    expect(result.success).toBe(true);
  });

  test("accepts empty object", () => {
    const result = updateKpiSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("rejects invalid status enum", () => {
    const result = updateKpiSchema.safeParse({ status: "COMPLETED" });
    expect(result.success).toBe(false);
  });

  test("rejects negative target in update", () => {
    const result = updateKpiSchema.safeParse({ target: -10 });
    expect(result.success).toBe(false);
  });

  test("rejects negative actual in update", () => {
    const result = updateKpiSchema.safeParse({ actual: -5 });
    expect(result.success).toBe(false);
  });

  test("rejects weight > 100 in update", () => {
    const result = updateKpiSchema.safeParse({ weight: 101 });
    expect(result.success).toBe(false);
  });
});

describe("createKpiAchievementSchema", () => {
  test("accepts valid achievement", () => {
    const result = createKpiAchievementSchema.safeParse({
      period: "2026-01",
      actualValue: 85.5,
      note: "Good progress",
    });
    expect(result.success).toBe(true);
  });

  test("accepts achievement without note", () => {
    const result = createKpiAchievementSchema.safeParse({
      period: "2026-Q1",
      actualValue: 90,
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing period", () => {
    const result = createKpiAchievementSchema.safeParse({ actualValue: 90 });
    expect(result.success).toBe(false);
  });

  test("rejects empty period", () => {
    const result = createKpiAchievementSchema.safeParse({ period: "", actualValue: 90 });
    expect(result.success).toBe(false);
  });

  test("rejects missing actualValue", () => {
    const result = createKpiAchievementSchema.safeParse({ period: "2026-01" });
    expect(result.success).toBe(false);
  });

  test("accepts zero as actualValue", () => {
    const result = createKpiAchievementSchema.safeParse({ period: "2026-01", actualValue: 0 });
    expect(result.success).toBe(true);
  });
});
