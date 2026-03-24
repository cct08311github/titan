import { createTaskChangeSchema } from "../task-change-validators";

describe("createTaskChangeSchema", () => {
  const validInput = {
    changeType: "DELAY",
    reason: "Client requested deadline extension",
  };

  test("accepts valid DELAY change", () => {
    const result = createTaskChangeSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  test("accepts valid SCOPE_CHANGE change", () => {
    const result = createTaskChangeSchema.safeParse({
      ...validInput,
      changeType: "SCOPE_CHANGE",
    });
    expect(result.success).toBe(true);
  });

  test("accepts change with all optional fields", () => {
    const result = createTaskChangeSchema.safeParse({
      ...validInput,
      oldValue: "2026-03-20",
      newValue: "2026-04-05",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.oldValue).toBe("2026-03-20");
      expect(result.data.newValue).toBe("2026-04-05");
    }
  });

  test("rejects arbitrary changeType string", () => {
    const result = createTaskChangeSchema.safeParse({
      ...validInput,
      changeType: "ARBITRARY_INJECTION",
    });
    expect(result.success).toBe(false);
  });

  test("rejects empty string changeType", () => {
    const result = createTaskChangeSchema.safeParse({
      ...validInput,
      changeType: "",
    });
    expect(result.success).toBe(false);
  });

  test("rejects numeric changeType", () => {
    const result = createTaskChangeSchema.safeParse({
      ...validInput,
      changeType: 42,
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing changeType", () => {
    const result = createTaskChangeSchema.safeParse({
      reason: "Some reason",
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing reason", () => {
    const result = createTaskChangeSchema.safeParse({
      changeType: "DELAY",
    });
    expect(result.success).toBe(false);
  });

  test("rejects empty reason string", () => {
    const result = createTaskChangeSchema.safeParse({
      changeType: "DELAY",
      reason: "",
    });
    expect(result.success).toBe(false);
  });

  test("rejects case-insensitive variants", () => {
    const variants = ["delay", "Delay", "scope_change", "Scope_Change"];
    for (const changeType of variants) {
      const result = createTaskChangeSchema.safeParse({ ...validInput, changeType });
      expect(result.success).toBe(false);
    }
  });
});
