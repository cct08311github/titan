import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from "../task-validators";

describe("createTaskSchema", () => {
  const validInput = {
    title: "Implement login page",
    status: "TODO",
    priority: "P1",
    category: "PLANNED",
  };

  test("accepts valid task input", () => {
    const result = createTaskSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  test("accepts valid task input with all optional fields", () => {
    const result = createTaskSchema.safeParse({
      ...validInput,
      description: "Some desc",
      monthlyGoalId: "goal-id-123",
      primaryAssigneeId: "user-id-1",
      backupAssigneeId: "user-id-2",
      dueDate: "2026-12-31T00:00:00.000Z",
      startDate: "2026-01-01T00:00:00.000Z",
      estimatedHours: 8,
      tags: ["frontend", "auth"],
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing title", () => {
    const { title: _title, ...rest } = validInput;
    const result = createTaskSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test("rejects empty title", () => {
    const result = createTaskSchema.safeParse({ ...validInput, title: "" });
    expect(result.success).toBe(false);
  });

  test("rejects invalid status enum", () => {
    const result = createTaskSchema.safeParse({
      ...validInput,
      status: "INVALID_STATUS",
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid priority enum", () => {
    const result = createTaskSchema.safeParse({
      ...validInput,
      priority: "P99",
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid category enum", () => {
    const result = createTaskSchema.safeParse({
      ...validInput,
      category: "UNKNOWN",
    });
    expect(result.success).toBe(false);
  });

  test("rejects non-date dueDate", () => {
    const result = createTaskSchema.safeParse({
      ...validInput,
      dueDate: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  test("rejects negative estimatedHours", () => {
    const result = createTaskSchema.safeParse({
      ...validInput,
      estimatedHours: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateTaskSchema", () => {
  test("accepts partial update with only title", () => {
    const result = updateTaskSchema.safeParse({ title: "New Title" });
    expect(result.success).toBe(true);
  });

  test("accepts partial update with only status", () => {
    const result = updateTaskSchema.safeParse({ status: "DONE" });
    expect(result.success).toBe(true);
  });

  test("accepts empty object (no fields)", () => {
    const result = updateTaskSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("rejects invalid status in update", () => {
    const result = updateTaskSchema.safeParse({ status: "FLYING" });
    expect(result.success).toBe(false);
  });

  test("rejects invalid priority in update", () => {
    const result = updateTaskSchema.safeParse({ priority: "HIGH" });
    expect(result.success).toBe(false);
  });

  test("rejects negative estimatedHours in update", () => {
    const result = updateTaskSchema.safeParse({ estimatedHours: -5 });
    expect(result.success).toBe(false);
  });

  test("accepts null dueDate (clear date)", () => {
    const result = updateTaskSchema.safeParse({ dueDate: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dueDate).toBeNull();
    }
  });

  test("accepts null startDate (clear date)", () => {
    const result = updateTaskSchema.safeParse({ startDate: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startDate).toBeNull();
    }
  });

  test("accepts valid datetime string for dueDate", () => {
    const result = updateTaskSchema.safeParse({
      dueDate: "2026-06-15T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  test("rejects invalid string for dueDate", () => {
    const result = updateTaskSchema.safeParse({ dueDate: "not-a-date" });
    expect(result.success).toBe(false);
  });

  test("accepts null primaryAssigneeId (unassign)", () => {
    const result = updateTaskSchema.safeParse({ primaryAssigneeId: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.primaryAssigneeId).toBeNull();
    }
  });

  test("accepts null backupAssigneeId (unassign)", () => {
    const result = updateTaskSchema.safeParse({ backupAssigneeId: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.backupAssigneeId).toBeNull();
    }
  });
});

describe("updateTaskStatusSchema", () => {
  test("accepts valid status BACKLOG", () => {
    const result = updateTaskStatusSchema.safeParse({ status: "BACKLOG" });
    expect(result.success).toBe(true);
  });

  test("accepts valid status IN_PROGRESS", () => {
    const result = updateTaskStatusSchema.safeParse({ status: "IN_PROGRESS" });
    expect(result.success).toBe(true);
  });

  test("accepts valid status DONE", () => {
    const result = updateTaskStatusSchema.safeParse({ status: "DONE" });
    expect(result.success).toBe(true);
  });

  test("rejects invalid status", () => {
    const result = updateTaskStatusSchema.safeParse({ status: "COMPLETED" });
    expect(result.success).toBe(false);
  });

  test("rejects missing status", () => {
    const result = updateTaskStatusSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
