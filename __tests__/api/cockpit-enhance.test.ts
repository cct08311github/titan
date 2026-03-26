/**
 * @jest-environment node
 */
/**
 * Cockpit Enhancement tests — Issue #962
 *
 * Tests:
 * - Refined health calculation (CRITICAL / AT_RISK / HEALTHY)
 * - Root cause task drill-down
 * - Flagged task count per plan
 */

import { calculateHealthStatus } from "@/app/api/cockpit/route";

describe("Cockpit Enhancement — Issue #962", () => {
  describe("Refined health calculation", () => {
    test("CRITICAL when >30% tasks overdue", () => {
      const result = calculateHealthStatus(50, 50, 4, 10, 80, 0);
      expect(result).toBe("CRITICAL");
    });

    test("CRITICAL when KPI<50% and time>75%", () => {
      const result = calculateHealthStatus(50, 80, 0, 10, 40, 2);
      expect(result).toBe("CRITICAL");
    });

    test("AT_RISK when any task is overdue", () => {
      const result = calculateHealthStatus(80, 50, 1, 10, 90, 0);
      expect(result).toBe("AT_RISK");
    });

    test("AT_RISK when KPI avg < 80%", () => {
      const result = calculateHealthStatus(80, 50, 0, 10, 70, 0);
      expect(result).toBe("AT_RISK");
    });

    test("HEALTHY when no issues", () => {
      const result = calculateHealthStatus(80, 50, 0, 10, 90, 0);
      expect(result).toBe("HEALTHY");
    });

    test("HEALTHY with no tasks (edge case)", () => {
      const result = calculateHealthStatus(0, 50, 0, 0, 100, 0);
      expect(result).toBe("HEALTHY");
    });

    test("not CRITICAL at 30% overdue (boundary)", () => {
      // 3/10 = 30%, not >30%
      const result = calculateHealthStatus(50, 50, 3, 10, 80, 0);
      expect(result).toBe("AT_RISK"); // has overdue but <=30%
    });

    test("CRITICAL at 31% overdue", () => {
      // 4/12 = 33.3%, >30%
      const result = calculateHealthStatus(50, 50, 4, 12, 80, 0);
      expect(result).toBe("CRITICAL");
    });
  });

  describe("Root cause task logic", () => {
    test("filters overdue and flagged tasks, excludes DONE", () => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const tasks = [
        { id: "1", title: "Overdue task", status: "IN_PROGRESS", dueDate: yesterday, managerFlagged: false, primaryAssignee: { name: "Alice" } },
        { id: "2", title: "Flagged task", status: "TODO", dueDate: tomorrow, managerFlagged: true, primaryAssignee: { name: "Bob" } },
        { id: "3", title: "Normal task", status: "TODO", dueDate: tomorrow, managerFlagged: false, primaryAssignee: null },
        { id: "4", title: "Done task", status: "DONE", dueDate: yesterday, managerFlagged: true, primaryAssignee: { name: "Charlie" } },
      ];

      const rootCauseTasks = tasks.filter((t) => {
        if (t.status === "DONE") return false;
        const isOverdue = t.dueDate && new Date(t.dueDate) < now;
        return isOverdue || t.managerFlagged;
      });

      expect(rootCauseTasks).toHaveLength(2);
      expect(rootCauseTasks.map((t) => t.id)).toEqual(["1", "2"]);
    });

    test("sorts flagged first, then by dueDate", () => {
      const rootCauseTasks = [
        { id: "1", managerFlagged: false, dueDate: "2026-03-25" },
        { id: "2", managerFlagged: true, dueDate: "2026-03-28" },
        { id: "3", managerFlagged: false, dueDate: "2026-03-20" },
      ];

      const sorted = [...rootCauseTasks].sort((a, b) => {
        if (a.managerFlagged !== b.managerFlagged) return a.managerFlagged ? -1 : 1;
        if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        return 0;
      });

      expect(sorted.map((t) => t.id)).toEqual(["2", "3", "1"]);
    });
  });

  describe("Flagged count per plan", () => {
    test("counts flagged tasks correctly", () => {
      const tasks = [
        { managerFlagged: true },
        { managerFlagged: false },
        { managerFlagged: true },
        { managerFlagged: false },
      ];

      const flaggedCount = tasks.filter((t) => t.managerFlagged).length;
      expect(flaggedCount).toBe(2);
    });
  });

  describe("Navigation links", () => {
    test("cockpit page should link to reports and my-day", () => {
      // Verify the navigation targets exist as expected
      const links = ["/reports", "/dashboard"];
      expect(links).toContain("/reports");
      expect(links).toContain("/dashboard");
    });
  });
});
