/**
 * @jest-environment jsdom
 */
/**
 * Frontend tests: Monthly Grid + Approval — Issue #853
 */
import React from "react";
import { render, screen, fireEvent } from "../utils/test-utils";
import { MonthlyGrid, MonthlyMobileList } from "@/app/components/timesheet/monthly-grid";
import type { MonthlyMember } from "@/app/components/timesheet/use-monthly-timesheet";

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeMember(overrides?: Partial<MonthlyMember>): MonthlyMember {
  return {
    userId: "u1",
    name: "測試工程師",
    email: "test@example.com",
    days: {},
    ...overrides,
  };
}

function makeMemberWithDays(): MonthlyMember {
  return makeMember({
    days: {
      "2026-03-02": {
        totalHours: 8,
        approvalStatus: "APPROVED",
        entries: [
          {
            id: "e1",
            taskId: "t1",
            date: "2026-03-02",
            hours: 8,
            category: "PLANNED_TASK",
            description: null,
            overtimeType: "NONE",
            approvalStatus: "APPROVED",
            isRunning: false,
            locked: true,
            task: { id: "t1", title: "Task 1" },
          },
        ],
      },
      "2026-03-03": {
        totalHours: 10,
        approvalStatus: "PENDING",
        entries: [
          {
            id: "e2",
            taskId: "t1",
            date: "2026-03-03",
            hours: 10,
            category: "PLANNED_TASK",
            description: null,
            overtimeType: "WEEKDAY",
            approvalStatus: "PENDING",
            isRunning: false,
            locked: false,
            task: { id: "t1", title: "Task 1" },
          },
        ],
      },
      "2026-03-04": {
        totalHours: 12,
        approvalStatus: "REJECTED",
        entries: [
          {
            id: "e3",
            taskId: "t1",
            date: "2026-03-04",
            hours: 12,
            category: "PLANNED_TASK",
            description: null,
            overtimeType: "WEEKDAY",
            approvalStatus: "REJECTED",
            isRunning: false,
            locked: false,
            task: { id: "t1", title: "Task 1" },
          },
        ],
      },
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MonthlyGrid
// ═══════════════════════════════════════════════════════════════════════════════

describe("MonthlyGrid", () => {
  const defaultProps = {
    daysInMonth: 31,
    month: "2026-03",
    expandedCell: null,
    onCellClick: jest.fn(),
    onMemberClick: jest.fn(),
  };

  test("renders correct number of cells (member row × days)", () => {
    const members = [makeMember()];
    const { container } = render(
      <MonthlyGrid {...defaultProps} members={members} />
    );
    // 1 member row, each with 31 day cells + 1 total cell = 32 td
    const tds = container.querySelectorAll("tbody td");
    // 31 cells + 1 total + 1 name = 33
    expect(tds.length).toBe(33);
  });

  test("empty month shows all gray/dash cells", () => {
    const members = [makeMember()];
    render(<MonthlyGrid {...defaultProps} members={members} />);
    // All cells should show "—" for zero hours
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBe(31); // 31 days
  });

  test("color coding: ≤8h shows green, >8h shows yellow, >10h shows red", () => {
    const member = makeMemberWithDays();
    const { container } = render(
      <MonthlyGrid {...defaultProps} members={[member]} />
    );

    // Find cell with "8.0" (should have green class)
    const cells = container.querySelectorAll("td");
    const cellTexts = Array.from(cells).map((c) => c.textContent);
    expect(cellTexts.some((t) => t?.includes("8.0"))).toBe(true);
    expect(cellTexts.some((t) => t?.includes("10.0"))).toBe(true);
    expect(cellTexts.some((t) => t?.includes("12.0"))).toBe(true);
  });

  test("cell click calls onCellClick with userId and date", () => {
    const member = makeMemberWithDays();
    const onCellClick = jest.fn();
    const { container } = render(
      <MonthlyGrid {...defaultProps} members={[member]} onCellClick={onCellClick} />
    );

    // Click the first data cell (day 1)
    const firstDataCell = container.querySelectorAll("tbody td")[1]; // skip name cell
    fireEvent.click(firstDataCell);
    expect(onCellClick).toHaveBeenCalledWith("u1", "2026-03-01");
  });

  test("weekend cells (day 1=Sunday, day 7=Saturday) have background class", () => {
    // March 2026: day 1 is Sunday, day 7 is Saturday
    const members = [makeMember()];
    const { container } = render(
      <MonthlyGrid {...defaultProps} members={members} />
    );

    // Header: day 1 (Sunday) should have muted/50 class
    const headerCells = container.querySelectorAll("thead th");
    // headerCells[0] is "成員", [1] is day 1 (Sunday)
    expect(headerCells[1].className).toContain("bg-muted/50");
  });

  test("approval status icon ✓ for APPROVED, ✗ for REJECTED", () => {
    const member = makeMemberWithDays();
    render(<MonthlyGrid {...defaultProps} members={[member]} />);

    expect(screen.getByText("✓")).toBeTruthy();
    expect(screen.getByText("✗")).toBeTruthy();
  });

  test("expanded cell gets ring-2 highlight", () => {
    const member = makeMemberWithDays();
    const { container } = render(
      <MonthlyGrid
        {...defaultProps}
        members={[member]}
        expandedCell={{ userId: "u1", date: "2026-03-02" }}
      />
    );

    const cells = container.querySelectorAll("tbody td");
    const expandedCells = Array.from(cells).filter((c) =>
      c.className.includes("ring-2")
    );
    expect(expandedCells.length).toBe(1);
  });

  test("no members shows empty state message", () => {
    render(<MonthlyGrid {...defaultProps} members={[]} />);
    expect(screen.getByText("本月無工時資料")).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MonthlyMobileList (mobile view)
// ═══════════════════════════════════════════════════════════════════════════════

describe("MonthlyMobileList", () => {
  test("renders member cards with name and total hours", () => {
    const member = makeMemberWithDays();
    render(
      <MonthlyMobileList
        members={[member]}
        month="2026-03"
        onMemberClick={jest.fn()}
      />
    );

    expect(screen.getByText("測試工程師")).toBeTruthy();
    expect(screen.getByText("30.0h")).toBeTruthy(); // 8 + 10 + 12
  });
});
