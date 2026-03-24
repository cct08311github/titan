/**
 * Page tests: Gantt
 */
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(() => ({
    data: { user: { id: "u1", name: "Alice", role: "MEMBER" }, expires: "2099" },
    status: "authenticated",
  })),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const GANTT_RESPONSE = {
  year: 2024,
  annualPlan: {
    id: "plan-1",
    title: "2024 Annual Plan",
    year: 2024,
    milestones: [],
    monthlyGoals: [
      {
        id: "goal-1",
        month: 1,
        title: "January Goal",
        status: "IN_PROGRESS",
        tasks: [
          {
            id: "t1",
            title: "Gantt Task 1",
            status: "IN_PROGRESS",
            priority: "P1",
            startDate: "2024-01-01",
            dueDate: "2024-01-31",
            primaryAssignee: { id: "u1", name: "Alice" },
            milestones: [],
          },
        ],
      },
    ],
  },
};

describe("Gantt Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockImplementation(() =>
      Promise.resolve({ ok: true, json: async () => GANTT_RESPONSE } as Response)
    );
  });

  it("renders without crashing", async () => {
    const { default: GanttPage } = await import("@/app/(app)/gantt/page");
    await act(async () => {
      render(<GanttPage />);
    });
    expect(document.body).toBeDefined();
  });

  it("shows task title after loading", async () => {
    const { default: GanttPage } = await import("@/app/(app)/gantt/page");
    await act(async () => {
      render(<GanttPage />);
    });
    await waitFor(() => {
      expect(screen.getByText("Gantt Task 1")).toBeInTheDocument();
    });
  });

  it("handles fetch error gracefully", async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
    const { default: GanttPage } = await import("@/app/(app)/gantt/page");
    await act(async () => {
      render(<GanttPage />);
    });
    expect(document.body).toBeDefined();
  });

  it("handles empty task list", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ year: 2024, annualPlan: null }) } as Response);
    const { default: GanttPage } = await import("@/app/(app)/gantt/page");
    await act(async () => {
      render(<GanttPage />);
    });
    expect(document.body).toBeDefined();
  });
});
