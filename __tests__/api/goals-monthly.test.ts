/**
 * @jest-environment node
 */
/**
 * Issue #817 -- Monthly Goals decomposition tests
 */

describe("Goal validation schemas", () => {
  it("createGoalSchema accepts assigneeId", () => {
    const { createGoalSchema } = require("@/validators/shared/plan");
    expect(createGoalSchema.safeParse({ annualPlanId: "p1", month: 3, title: "Q1", assigneeId: "u1" }).success).toBe(true);
  });

  it("createGoalSchema works without assigneeId", () => {
    const { createGoalSchema } = require("@/validators/shared/plan");
    expect(createGoalSchema.safeParse({ annualPlanId: "p1", month: 3, title: "Q1" }).success).toBe(true);
  });

  it("createGoalSchema rejects month > 12", () => {
    const { createGoalSchema } = require("@/validators/shared/plan");
    expect(createGoalSchema.safeParse({ annualPlanId: "p", month: 13, title: "X" }).success).toBe(false);
  });

  it("createGoalSchema rejects month < 1", () => {
    const { createGoalSchema } = require("@/validators/shared/plan");
    expect(createGoalSchema.safeParse({ annualPlanId: "p", month: 0, title: "X" }).success).toBe(false);
  });

  it("updateGoalSchema accepts status change", () => {
    const { updateGoalSchema } = require("@/validators/shared/plan");
    expect(updateGoalSchema.safeParse({ status: "COMPLETED" }).success).toBe(true);
    expect(updateGoalSchema.safeParse({ status: "NOT_STARTED" }).success).toBe(true);
  });

  it("updateGoalSchema accepts assigneeId as nullable", () => {
    const { updateGoalSchema } = require("@/validators/shared/plan");
    expect(updateGoalSchema.safeParse({ assigneeId: "u1" }).success).toBe(true);
    expect(updateGoalSchema.safeParse({ assigneeId: null }).success).toBe(true);
  });

  it("updateGoalSchema rejects invalid status", () => {
    const { updateGoalSchema } = require("@/validators/shared/plan");
    expect(updateGoalSchema.safeParse({ status: "INVALID" }).success).toBe(false);
  });
});

describe("Goals API routes exist", () => {
  it("goals/route.ts exports GET and POST", async () => {
    const mod = await import("@/app/api/goals/route");
    expect(mod).toHaveProperty("GET");
    expect(mod).toHaveProperty("POST");
  });

  it("goals/[id]/route.ts exports GET, PUT, DELETE", async () => {
    const mod = await import("@/app/api/goals/[id]/route");
    expect(mod).toHaveProperty("GET");
    expect(mod).toHaveProperty("PUT");
    expect(mod).toHaveProperty("DELETE");
  });
});
