import { createKpiSchema, updateKpiSchema } from "../kpi-validators";

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
      weight: 2.0,
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
});
