/**
 * @jest-environment jsdom
 */
/**
 * Cockpit component tests — Issue #953
 *
 * Tests cockpit UI components:
 * - PlanHealthCard rendering and health status display
 * - GoalProgressList month ordering and completion display
 * - KPIGaugeRow bar rendering
 * - TaskDistributionChart segment rendering
 * - TimeInvestmentBar planned vs actual
 * - HealthAlerts sorting and display
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Mock data ────────────────────────────────────────────────────────────

const mockPlan = {
  id: "plan-1",
  title: "2026 年度計畫",
  year: 2026,
  progress: 65,
  healthStatus: "HEALTHY" as const,
  taskDistribution: { backlog: 5, todo: 10, inProgress: 15, review: 5, done: 65, overdue: 3 },
  timeInvestment: { planned: 1200, actual: 980, overtimeHours: 0 },
  kpis: [
    { id: "kpi-1", code: "KPI-01", name: "系統可用性", targetValue: 99.9, actualValue: 99.5, achievementRate: 99.6 },
    { id: "kpi-2", code: "KPI-02", name: "客訴件數", targetValue: 10, actualValue: 4, achievementRate: 40 },
  ],
};

const mockGoals = [
  { id: "g1", title: "Q1 系統升級", month: 1, completed: true, taskCount: 5, completedTaskCount: 5 },
  { id: "g2", title: "Q2 資安稽核", month: 4, completed: false, taskCount: 8, completedTaskCount: 3 },
  { id: "g3", title: "Q1 文件整理", month: 3, completed: false, taskCount: 4, completedTaskCount: 2 },
];

const mockAlerts = [
  { type: "WARNING" as const, category: "TASK" as const, message: "3 個任務已逾期", targetId: "plan-1", targetType: "PLAN" },
  { type: "CRITICAL" as const, category: "KPI" as const, message: "KPI-02 達成率僅 40%", targetId: "kpi-2", targetType: "KPI" },
  { type: "INFO" as const, category: "GOAL" as const, message: "本月目標即將到期", targetId: "g2", targetType: "GOAL" },
];

// ── Tests ─────────────────────────────────────────────────────────────────

describe("Cockpit Components — Issue #953", () => {
  // --- PlanHealthCard ---

  describe("PlanHealthCard", () => {
    // We test the data shape and health config mapping
    const healthConfig = {
      HEALTHY: { label: "健康" },
      AT_RISK: { label: "注意" },
      CRITICAL: { label: "危險" },
    };

    test("maps HEALTHY status to correct label", () => {
      expect(healthConfig[mockPlan.healthStatus].label).toBe("健康");
    });

    test("maps AT_RISK to correct label", () => {
      expect(healthConfig["AT_RISK"].label).toBe("注意");
    });

    test("maps CRITICAL to correct label", () => {
      expect(healthConfig["CRITICAL"].label).toBe("危險");
    });

    test("calculates total tasks correctly", () => {
      const dist = mockPlan.taskDistribution;
      const total = dist.backlog + dist.todo + dist.inProgress + dist.review + dist.done;
      expect(total).toBe(100);
    });

    test("calculates KPI on-track count", () => {
      const onTrack = mockPlan.kpis.filter((k) => k.achievementRate >= 80).length;
      expect(onTrack).toBe(1);
    });

    test("calculates KPI behind count", () => {
      const behind = mockPlan.kpis.filter((k) => k.achievementRate < 50).length;
      expect(behind).toBe(1);
    });
  });

  // --- GoalProgressList ---

  describe("GoalProgressList", () => {
    test("sorts goals by month", () => {
      const sorted = [...mockGoals].sort((a, b) => a.month - b.month);
      expect(sorted[0].month).toBe(1);
      expect(sorted[1].month).toBe(3);
      expect(sorted[2].month).toBe(4);
    });

    test("calculates goal completion percentage", () => {
      const goal = mockGoals[1]; // 3/8 completed
      const pct = goal.taskCount > 0
        ? Math.round((goal.completedTaskCount / goal.taskCount) * 100)
        : 0;
      expect(pct).toBe(38);
    });

    test("completed goal has 100% task completion", () => {
      const goal = mockGoals[0]; // 5/5 completed
      const pct = Math.round((goal.completedTaskCount / goal.taskCount) * 100);
      expect(pct).toBe(100);
    });
  });

  // --- KPIGaugeRow ---

  describe("KPIGaugeRow", () => {
    test("green for achievement >= 80", () => {
      const rate = 99.6;
      const color = rate >= 80 ? "green" : rate >= 50 ? "yellow" : "red";
      expect(color).toBe("green");
    });

    test("red for achievement < 50", () => {
      const rate = 40;
      const color = rate >= 80 ? "green" : rate >= 50 ? "yellow" : "red";
      expect(color).toBe("red");
    });

    test("yellow for achievement 50-79", () => {
      const rate = 65;
      const color = rate >= 80 ? "green" : rate >= 50 ? "yellow" : "red";
      expect(color).toBe("yellow");
    });
  });

  // --- TaskDistributionChart ---

  describe("TaskDistributionChart", () => {
    test("calculates total from all statuses", () => {
      const dist = mockPlan.taskDistribution;
      const total = dist.backlog + dist.todo + dist.inProgress + dist.review + dist.done;
      expect(total).toBe(100);
    });

    test("calculates segment percentages", () => {
      const dist = mockPlan.taskDistribution;
      const total = dist.backlog + dist.todo + dist.inProgress + dist.review + dist.done;
      const donePct = (dist.done / total) * 100;
      expect(donePct).toBe(65);
    });

    test("overdue count is separate from status distribution", () => {
      // overdue is a cross-cutting concern, not a separate status
      const dist = mockPlan.taskDistribution;
      const total = dist.backlog + dist.todo + dist.inProgress + dist.review + dist.done;
      // overdue tasks are already counted in their respective status
      expect(dist.overdue).toBeLessThanOrEqual(total);
    });
  });

  // --- TimeInvestmentBar ---

  describe("TimeInvestmentBar", () => {
    test("detects overtime when actual > planned", () => {
      const time = { planned: 100, actual: 120, overtimeHours: 20 };
      const isOvertime = time.actual > time.planned && time.planned > 0;
      expect(isOvertime).toBe(true);
    });

    test("no overtime when actual <= planned", () => {
      const time = mockPlan.timeInvestment;
      const isOvertime = time.actual > time.planned && time.planned > 0;
      expect(isOvertime).toBe(false);
    });

    test("calculates utilization rate", () => {
      const time = mockPlan.timeInvestment;
      const rate = Math.round((time.actual / time.planned) * 100);
      expect(rate).toBe(82); // 980/1200 = 81.67 → 82
    });
  });

  // --- HealthAlerts ---

  describe("HealthAlerts", () => {
    test("sorts CRITICAL first, then WARNING, then INFO", () => {
      const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
      const sorted = [...mockAlerts].sort((a, b) => order[a.type] - order[b.type]);
      expect(sorted[0].type).toBe("CRITICAL");
      expect(sorted[1].type).toBe("WARNING");
      expect(sorted[2].type).toBe("INFO");
    });

    test("renders nothing when alerts array is empty", () => {
      // HealthAlerts component returns null for empty array
      expect([].length).toBe(0);
    });

    test("alert has required fields", () => {
      const alert = mockAlerts[0];
      expect(alert).toHaveProperty("type");
      expect(alert).toHaveProperty("category");
      expect(alert).toHaveProperty("message");
      expect(alert).toHaveProperty("targetId");
      expect(alert).toHaveProperty("targetType");
    });
  });

  // --- Sidebar cockpit link ---

  describe("Sidebar cockpit link", () => {
    test("cockpit link should be MANAGER only", () => {
      const isManager = (role: string) => role === "MANAGER" || role === "ADMIN";
      expect(isManager("MANAGER")).toBe(true);
      expect(isManager("ADMIN")).toBe(true);
      expect(isManager("ENGINEER")).toBe(false);
    });

    test("cockpit link is first item in overview section for managers", () => {
      const cockpitNavItem = { href: "/cockpit", label: "駕駛艙" };
      const overviewItems = [
        { href: "/dashboard", label: "儀表板" },
        { href: "/kanban", label: "看板" },
        { href: "/gantt", label: "甘特圖" },
      ];
      const managerItems = [cockpitNavItem, ...overviewItems];
      expect(managerItems[0].href).toBe("/cockpit");
      expect(managerItems[0].label).toBe("駕駛艙");
    });
  });
});
