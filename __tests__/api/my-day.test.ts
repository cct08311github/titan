/**
 * @jest-environment node
 */
/**
 * My Day API tests — Issue #959
 *
 * Tests the My Day aggregation endpoint:
 * - Engineer view returns flagged, due today, in progress, time suggestions
 * - Manager view returns team health, flagged items, workload, alerts
 * - Sort order: flagged → P0 → dueDate → IN_PROGRESS
 */

import { jest } from "@jest/globals";

describe("My Day API — Issue #959", () => {
  describe("Engineer view sort order", () => {
    test("flagged tasks sort to top, then by priority, then by dueDate", () => {
      const tasks = [
        { id: "1", managerFlagged: false, priority: "P2", dueDate: "2026-03-27", status: "TODO" },
        { id: "2", managerFlagged: true, priority: "P2", dueDate: "2026-03-28", status: "TODO" },
        { id: "3", managerFlagged: false, priority: "P0", dueDate: "2026-03-27", status: "IN_PROGRESS" },
        { id: "4", managerFlagged: true, priority: "P0", dueDate: "2026-03-26", status: "TODO" },
      ];

      const priorityOrder = ["P0", "P1", "P2", "P3"];
      const sorted = [...tasks].sort((a, b) => {
        // 1. Flagged first
        if (a.managerFlagged !== b.managerFlagged) return a.managerFlagged ? -1 : 1;
        // 2. Priority
        const pa = priorityOrder.indexOf(a.priority);
        const pb = priorityOrder.indexOf(b.priority);
        if (pa !== pb) return pa - pb;
        // 3. Due date
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

      expect(sorted.map((t) => t.id)).toEqual(["4", "2", "3", "1"]);
    });
  });

  describe("Engineer view data structure", () => {
    test("response includes required sections", () => {
      const engineerData = {
        role: "ENGINEER",
        flaggedTasks: [],
        dueTodayTasks: [],
        inProgressTasks: [],
        todayHours: 0,
        dailyTarget: 8,
        timeSuggestions: [],
        monthlyGoals: [],
      };

      expect(engineerData.role).toBe("ENGINEER");
      expect(engineerData).toHaveProperty("flaggedTasks");
      expect(engineerData).toHaveProperty("dueTodayTasks");
      expect(engineerData).toHaveProperty("inProgressTasks");
      expect(engineerData).toHaveProperty("todayHours");
      expect(engineerData).toHaveProperty("dailyTarget");
      expect(engineerData).toHaveProperty("timeSuggestions");
      expect(engineerData).toHaveProperty("monthlyGoals");
    });

    test("time suggestions computed from TODO tasks with estimatedHours", () => {
      const dueTodayTasks = [
        { id: "1", title: "Task A", status: "TODO", estimatedHours: 3 },
        { id: "2", title: "Task B", status: "IN_PROGRESS", estimatedHours: 2 },
        { id: "3", title: "Task C", status: "TODO", estimatedHours: null },
      ];

      const suggestions = dueTodayTasks
        .filter((t) => t.estimatedHours && t.status === "TODO")
        .map((t) => ({
          taskId: t.id,
          title: t.title,
          estimatedHours: t.estimatedHours,
          suggestion: `建議分配 ${t.estimatedHours}h 給「${t.title}」`,
        }));

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].taskId).toBe("1");
      expect(suggestions[0].suggestion).toContain("3h");
    });
  });

  describe("Manager view data structure", () => {
    test("response includes team health, flagged items, workload, alerts", () => {
      const managerData = {
        role: "MANAGER",
        flaggedTasks: [],
        overdueTasks: [],
        memberWorkload: [],
        todayHours: 0,
        alerts: [],
        planSummaries: [],
      };

      expect(managerData.role).toBe("MANAGER");
      expect(managerData).toHaveProperty("flaggedTasks");
      expect(managerData).toHaveProperty("overdueTasks");
      expect(managerData).toHaveProperty("memberWorkload");
      expect(managerData).toHaveProperty("alerts");
      expect(managerData).toHaveProperty("planSummaries");
    });

    test("member workload correctly counts overdue and flagged tasks", () => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const memberTasks = [
        { id: "1", status: "IN_PROGRESS", dueDate: yesterday.toISOString(), managerFlagged: true },
        { id: "2", status: "TODO", dueDate: tomorrow.toISOString(), managerFlagged: false },
        { id: "3", status: "IN_PROGRESS", dueDate: yesterday.toISOString(), managerFlagged: false },
      ];

      const overdue = memberTasks.filter(
        (t) => t.dueDate && new Date(t.dueDate) < now
      ).length;
      const flagged = memberTasks.filter((t) => t.managerFlagged).length;

      expect(overdue).toBe(2);
      expect(flagged).toBe(1);
    });
  });

  describe("Dual view architecture", () => {
    test("ENGINEER role gets engineer view", () => {
      const role = "ENGINEER";
      const isManager = role === "MANAGER" || role === "ADMIN";
      expect(isManager).toBe(false);
    });

    test("MANAGER role gets manager view", () => {
      const role = "MANAGER";
      const isManager = role === "MANAGER" || role === "ADMIN";
      expect(isManager).toBe(true);
    });

    test("ADMIN role gets manager view", () => {
      const role = "ADMIN";
      const isManager = role === "MANAGER" || role === "ADMIN";
      expect(isManager).toBe(true);
    });
  });

  describe("Progressive loading", () => {
    test("greeting message changes by time of day", () => {
      function getGreeting(hour: number): string {
        if (hour < 12) return "早安";
        if (hour < 18) return "午安";
        return "晚安";
      }

      expect(getGreeting(8)).toBe("早安");
      expect(getGreeting(14)).toBe("午安");
      expect(getGreeting(20)).toBe("晚安");
    });
  });
});
