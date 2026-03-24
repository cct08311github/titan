/**
 * @jest-environment node
 */
import {
  createSubTaskSchema,
  updateSubTaskSchema,
} from "../subtask-validators";

describe("createSubTaskSchema", () => {
  const validInput = {
    taskId: "task-id-123",
    title: "Write unit tests",
  };

  test("accepts valid minimal input", () => {
    const result = createSubTaskSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.order).toBe(0);
    }
  });

  test("accepts valid input with all optional fields", () => {
    const result = createSubTaskSchema.safeParse({
      ...validInput,
      assigneeId: "user-id-1",
      dueDate: "2026-12-31T00:00:00.000Z",
      order: 3,
    });
    expect(result.success).toBe(true);
  });

  test("accepts null assigneeId", () => {
    const result = createSubTaskSchema.safeParse({
      ...validInput,
      assigneeId: null,
    });
    expect(result.success).toBe(true);
  });

  test("accepts null dueDate", () => {
    const result = createSubTaskSchema.safeParse({
      ...validInput,
      dueDate: null,
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing taskId", () => {
    const { taskId: _taskId, ...rest } = validInput;
    const result = createSubTaskSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test("rejects empty taskId", () => {
    const result = createSubTaskSchema.safeParse({ ...validInput, taskId: "" });
    expect(result.success).toBe(false);
  });

  test("rejects missing title", () => {
    const { title: _title, ...rest } = validInput;
    const result = createSubTaskSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test("rejects empty title", () => {
    const result = createSubTaskSchema.safeParse({ ...validInput, title: "" });
    expect(result.success).toBe(false);
  });

  test("rejects non-datetime dueDate", () => {
    const result = createSubTaskSchema.safeParse({
      ...validInput,
      dueDate: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  test("rejects negative order", () => {
    const result = createSubTaskSchema.safeParse({
      ...validInput,
      order: -1,
    });
    expect(result.success).toBe(false);
  });

  test("rejects non-integer order", () => {
    const result = createSubTaskSchema.safeParse({
      ...validInput,
      order: 1.5,
    });
    expect(result.success).toBe(false);
  });

  test("strips unknown fields", () => {
    const result = createSubTaskSchema.safeParse({
      ...validInput,
      malicious: "<script>alert(1)</script>",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).malicious).toBeUndefined();
    }
  });
});

describe("updateSubTaskSchema", () => {
  test("accepts partial update with only title", () => {
    const result = updateSubTaskSchema.safeParse({ title: "New Title" });
    expect(result.success).toBe(true);
  });

  test("accepts partial update with only done", () => {
    const result = updateSubTaskSchema.safeParse({ done: true });
    expect(result.success).toBe(true);
  });

  test("accepts empty object (no fields)", () => {
    const result = updateSubTaskSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("accepts null assigneeId for unassign", () => {
    const result = updateSubTaskSchema.safeParse({ assigneeId: null });
    expect(result.success).toBe(true);
  });

  test("accepts null dueDate for clearing", () => {
    const result = updateSubTaskSchema.safeParse({ dueDate: null });
    expect(result.success).toBe(true);
  });

  test("rejects empty title", () => {
    const result = updateSubTaskSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  test("rejects non-boolean done", () => {
    const result = updateSubTaskSchema.safeParse({ done: "yes" });
    expect(result.success).toBe(false);
  });

  test("rejects non-datetime dueDate string", () => {
    const result = updateSubTaskSchema.safeParse({ dueDate: "tomorrow" });
    expect(result.success).toBe(false);
  });

  test("rejects negative order", () => {
    const result = updateSubTaskSchema.safeParse({ order: -3 });
    expect(result.success).toBe(false);
  });
});
