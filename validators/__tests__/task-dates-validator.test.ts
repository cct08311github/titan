import { updateTaskDatesSchema } from "../shared/task";

describe("updateTaskDatesSchema — Issue #844 (G-3)", () => {
  test("accepts valid startDate and dueDate", () => {
    const result = updateTaskDatesSchema.safeParse({
      startDate: "2026-03-01T00:00:00.000Z",
      dueDate: "2026-03-31T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  test("accepts null startDate", () => {
    const result = updateTaskDatesSchema.safeParse({
      startDate: null,
      dueDate: "2026-03-31T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  test("accepts null dueDate", () => {
    const result = updateTaskDatesSchema.safeParse({
      startDate: "2026-03-01T00:00:00.000Z",
      dueDate: null,
    });
    expect(result.success).toBe(true);
  });

  test("rejects startDate after dueDate", () => {
    const result = updateTaskDatesSchema.safeParse({
      startDate: "2026-04-01T00:00:00.000Z",
      dueDate: "2026-03-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("開始日不可晚於到期日");
    }
  });

  test("accepts same startDate and dueDate", () => {
    const result = updateTaskDatesSchema.safeParse({
      startDate: "2026-03-15T00:00:00.000Z",
      dueDate: "2026-03-15T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  test("accepts empty object", () => {
    const result = updateTaskDatesSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
