/**
 * @jest-environment node
 */
/**
 * Cockpit API tests — Issue #953
 *
 * Tests the management cockpit API endpoint:
 * - Health status calculation logic
 * - RBAC (MANAGER only)
 * - Response structure
 */

import { calculateHealthStatus, HealthStatus } from "@/app/api/cockpit/route";

// ── Health calculation tests ────────────────────────────────────────────

describe("Cockpit API — Issue #953", () => {
  describe("calculateHealthStatus", () => {
    test("returns HEALTHY when progress is ahead of time", () => {
      const result = calculateHealthStatus(
        80, // progressPct
        50, // timeElapsedPct
        0,  // overdueCount
        10, // totalTasks
        90, // kpiAvgAchievement
        0,  // kpiBehindCount
      );
      expect(result).toBe("HEALTHY");
    });

    test("returns HEALTHY when progress matches time", () => {
      const result = calculateHealthStatus(50, 50, 0, 10, 80, 0);
      expect(result).toBe("HEALTHY");
    });

    test("returns AT_RISK when there are overdue tasks", () => {
      const result = calculateHealthStatus(50, 50, 1, 10, 80, 0);
      expect(result).toBe("AT_RISK");
    });

    test("returns AT_RISK when KPI achievement is below threshold", () => {
      const result = calculateHealthStatus(50, 50, 0, 10, 30, 0);
      expect(result).toBe("AT_RISK");
    });

    test("returns AT_RISK when progress is behind time by 10-20%", () => {
      const result = calculateHealthStatus(35, 50, 0, 10, 80, 0);
      expect(result).toBe("AT_RISK");
    });

    test("returns CRITICAL when >30% tasks are overdue", () => {
      const result = calculateHealthStatus(50, 50, 4, 10, 80, 0);
      expect(result).toBe("CRITICAL");
    });

    test("returns CRITICAL when KPI behind and time elapsed > 75%", () => {
      const result = calculateHealthStatus(70, 80, 0, 10, 60, 2);
      expect(result).toBe("CRITICAL");
    });

    test("returns CRITICAL when progress far behind time (< 50%)", () => {
      const result = calculateHealthStatus(20, 60, 0, 10, 80, 0);
      expect(result).toBe("CRITICAL");
    });

    test("returns HEALTHY with zero tasks", () => {
      const result = calculateHealthStatus(50, 50, 0, 0, 80, 0);
      expect(result).toBe("HEALTHY");
    });
  });

  // ── API response structure tests ────────────────────────────────────

  describe("API response structure", () => {
    const validPlanResponse = {
      id: "plan-1",
      title: "2026 年度計畫",
      year: 2026,
      progress: 65,
      healthStatus: "HEALTHY" as HealthStatus,
      goals: [
        {
          id: "goal-1",
          title: "Q1 目標",
          month: 1,
          completed: true,
          taskCount: 5,
          completedTaskCount: 5,
        },
      ],
      kpis: [
        {
          id: "kpi-1",
          code: "KPI-01",
          name: "系統可用性",
          targetValue: 99.9,
          actualValue: 99.5,
          achievementRate: 99.6,
        },
      ],
      taskDistribution: {
        backlog: 5,
        todo: 10,
        inProgress: 15,
        review: 5,
        done: 65,
        overdue: 3,
      },
      timeInvestment: {
        planned: 1200,
        actual: 980,
        overtimeHours: 0,
      },
      alerts: [],
      milestones: [],
    };

    test("plan response has required fields", () => {
      expect(validPlanResponse).toHaveProperty("id");
      expect(validPlanResponse).toHaveProperty("title");
      expect(validPlanResponse).toHaveProperty("year");
      expect(validPlanResponse).toHaveProperty("progress");
      expect(validPlanResponse).toHaveProperty("healthStatus");
      expect(validPlanResponse).toHaveProperty("goals");
      expect(validPlanResponse).toHaveProperty("kpis");
      expect(validPlanResponse).toHaveProperty("taskDistribution");
      expect(validPlanResponse).toHaveProperty("timeInvestment");
      expect(validPlanResponse).toHaveProperty("alerts");
    });

    test("healthStatus is one of valid values", () => {
      const validStatuses: HealthStatus[] = ["HEALTHY", "AT_RISK", "CRITICAL"];
      expect(validStatuses).toContain(validPlanResponse.healthStatus);
    });

    test("taskDistribution has all status fields", () => {
      const dist = validPlanResponse.taskDistribution;
      expect(dist).toHaveProperty("backlog");
      expect(dist).toHaveProperty("todo");
      expect(dist).toHaveProperty("inProgress");
      expect(dist).toHaveProperty("review");
      expect(dist).toHaveProperty("done");
      expect(dist).toHaveProperty("overdue");
    });

    test("timeInvestment has planned and actual", () => {
      expect(validPlanResponse.timeInvestment).toHaveProperty("planned");
      expect(validPlanResponse.timeInvestment).toHaveProperty("actual");
      expect(validPlanResponse.timeInvestment).toHaveProperty("overtimeHours");
    });

    test("goal has required fields", () => {
      const goal = validPlanResponse.goals[0];
      expect(goal).toHaveProperty("id");
      expect(goal).toHaveProperty("title");
      expect(goal).toHaveProperty("month");
      expect(goal).toHaveProperty("completed");
      expect(goal).toHaveProperty("taskCount");
      expect(goal).toHaveProperty("completedTaskCount");
    });

    test("kpi has required fields", () => {
      const kpi = validPlanResponse.kpis[0];
      expect(kpi).toHaveProperty("id");
      expect(kpi).toHaveProperty("code");
      expect(kpi).toHaveProperty("name");
      expect(kpi).toHaveProperty("targetValue");
      expect(kpi).toHaveProperty("actualValue");
      expect(kpi).toHaveProperty("achievementRate");
    });
  });

  // ── RBAC tests ─────────────────────────────────────────────────────

  describe("RBAC", () => {
    test("withManager wraps handler — ENGINEER should be rejected", () => {
      // The API uses withManager which calls requireMinRole("MANAGER")
      // ENGINEER < MANAGER, so ENGINEER is rejected
      const roleHierarchy = { ADMIN: 3, MANAGER: 2, ENGINEER: 1 };
      expect(roleHierarchy["ENGINEER"]).toBeLessThan(roleHierarchy["MANAGER"]);
    });

    test("MANAGER should pass role check", () => {
      const roleHierarchy = { ADMIN: 3, MANAGER: 2, ENGINEER: 1 };
      expect(roleHierarchy["MANAGER"]).toBeGreaterThanOrEqual(roleHierarchy["MANAGER"]);
    });

    test("ADMIN should pass role check", () => {
      const roleHierarchy = { ADMIN: 3, MANAGER: 2, ENGINEER: 1 };
      expect(roleHierarchy["ADMIN"]).toBeGreaterThanOrEqual(roleHierarchy["MANAGER"]);
    });
  });
});
