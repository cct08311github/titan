/**
 * Page tests: Plans (app/(app)/plans/page.tsx)
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

// Mock heavy child components
jest.mock("@/app/components/plan-tree", () => ({
  PlanTree: ({
    plans,
  }: {
    plans: Array<{ id: string; year: number; title: string }>;
  }) => (
    <div data-testid="plan-tree">
      {plans.map((p) => (
        <div key={p.id} data-testid="plan-item">
          {p.year} — {p.title}
        </div>
      ))}
    </div>
  ),
}));

jest.mock("@/app/components/task-detail-modal", () => ({
  TaskDetailModal: () => <div data-testid="task-detail-modal" />,
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const PLANS_RESPONSE = [
  {
    id: "plan-1",
    year: 2024,
    title: "2024 年度計畫",
    progressPct: 60,
    monthlyGoals: [
      {
        id: "goal-1",
        month: 1,
        title: "一月目標",
        status: "IN_PROGRESS",
        progressPct: 50,
        _count: { tasks: 3 },
      },
    ],
  },
];

describe("Plans Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => PLANS_RESPONSE,
    } as Response);
  });

  it("renders without crashing", async () => {
    const { default: PlansPage } = await import("@/app/(app)/plans/page");
    await act(async () => {
      render(<PlansPage />);
    });
    expect(document.body).toBeDefined();
  });

  it("displays the page heading", async () => {
    const { default: PlansPage } = await import("@/app/(app)/plans/page");
    await act(async () => {
      render(<PlansPage />);
    });
    // "年度計畫" appears in both the breadcrumb and the h1
    const headings = screen.getAllByText("年度計畫");
    expect(headings.length).toBeGreaterThanOrEqual(1);
    // Verify the h1 specifically
    expect(screen.getByRole("heading", { name: "年度計畫" })).toBeInTheDocument();
  });

  it("renders PlanTree with fetched plans", async () => {
    const { default: PlansPage } = await import("@/app/(app)/plans/page");
    await act(async () => {
      render(<PlansPage />);
    });
    await waitFor(() => {
      expect(screen.getByTestId("plan-tree")).toBeInTheDocument();
    });
  });

  it("renders plan item title from API data", async () => {
    const { default: PlansPage } = await import("@/app/(app)/plans/page");
    await act(async () => {
      render(<PlansPage />);
    });
    await waitFor(() => {
      expect(screen.getByText(/2024 年度計畫/)).toBeInTheDocument();
    });
  });

  it("shows empty state guidance when plans list is empty", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
    const { default: PlansPage } = await import("@/app/(app)/plans/page");
    await act(async () => {
      render(<PlansPage />);
    });
    await waitFor(() => {
      // 空資料時應顯示引導訊息 + CTA（T1316: 空狀態 CTA 改版）
      expect(screen.getByText("建立第一個年度計畫，把目標落實到月度行動")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "建立計畫" })).toBeInTheDocument();
    });
    // 空資料時不應渲染 PlanTree
    expect(screen.queryByTestId("plan-tree")).not.toBeInTheDocument();
  });

  it("handles fetch failure without crashing", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);
    const { default: PlansPage } = await import("@/app/(app)/plans/page");
    await act(async () => {
      render(<PlansPage />);
    });
    expect(document.body).toBeDefined();
  });

  it("shows action buttons for adding plans and goals", async () => {
    const { default: PlansPage } = await import("@/app/(app)/plans/page");
    await act(async () => {
      render(<PlansPage />);
    });
    expect(screen.getByText("新增月度目標")).toBeInTheDocument();
    expect(screen.getByText("新增年度計畫")).toBeInTheDocument();
  });

  it("shows breadcrumb and subtitle text", async () => {
    const { default: PlansPage } = await import("@/app/(app)/plans/page");
    await act(async () => {
      render(<PlansPage />);
    });
    // Subtitle below heading
    expect(screen.getByText("管理年度計畫與月度目標")).toBeInTheDocument();
  });
});
