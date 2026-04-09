/**
 * Component tests: StaleTaskWidget — Issue #1312
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock sonner toast
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const STALE_TASKS = [
  {
    id: "task-esc-1",
    title: "升級任務一",
    level: "ESCALATE",
    daysSinceUpdate: 20,
    dueDate: null,
    assigneeName: "Alice",
    status: "IN_PROGRESS",
  },
  {
    id: "task-warn-1",
    title: "警告任務一",
    level: "WARN",
    daysSinceUpdate: 10,
    dueDate: "2024-12-31T00:00:00.000Z",
    assigneeName: "Bob",
    status: "TODO",
  },
  {
    id: "task-remind-1",
    title: "提醒任務一",
    level: "REMIND",
    daysSinceUpdate: 4,
    dueDate: null,
    assigneeName: "Charlie",
    status: "BACKLOG",
  },
];

function makeFetchSuccess(tasks = STALE_TASKS) {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { tasks, total: tasks.length } }),
  } as Response);
}

function makeFetchError(status = 500) {
  return jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ message: "伺服器錯誤" }),
  } as unknown as Response);
}

// Lazy import to avoid module caching issues
async function renderWidget(role: "ADMIN" | "MANAGER" | "ENGINEER") {
  const { StaleTaskWidget } = await import(
    "@/app/components/stale-task-widget"
  );
  return render(<StaleTaskWidget role={role} />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("StaleTaskWidget", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  it("shows skeleton while loading", async () => {
    // Delay the fetch response so we can observe loading state
    let resolvePromise!: () => void;
    const pendingFetch = new Promise<Response>((resolve) => {
      resolvePromise = () =>
        resolve({
          ok: true,
          json: async () => ({ data: { tasks: [], total: 0 } }),
        } as Response);
    });
    mockFetch.mockReturnValue(pendingFetch);

    const { StaleTaskWidget } = await import("@/app/components/stale-task-widget");
    render(<StaleTaskWidget role="ENGINEER" />);

    // The loading skeleton has aria-busy and aria-label
    expect(screen.getByLabelText("載入停滯任務中")).toBeInTheDocument();

    // Cleanup: resolve the pending fetch
    resolvePromise();
    await waitFor(() => {
      expect(screen.queryByLabelText("載入停滯任務中")).not.toBeInTheDocument();
    });
  });

  // ── ENGINEER role ──────────────────────────────────────────────────────────

  it("ENGINEER: renders tasks and hides assignee column", async () => {
    mockFetch.mockImplementation(makeFetchSuccess());

    await act(async () => {
      await renderWidget("ENGINEER");
    });

    await waitFor(() => {
      expect(screen.getByText("升級任務一")).toBeInTheDocument();
    });

    // Assignee names should NOT be shown for ENGINEER
    expect(screen.queryByText(/Alice/)).not.toBeInTheDocument();
    // Task title should be visible
    expect(screen.getByText("警告任務一")).toBeInTheDocument();
    expect(screen.getByText("提醒任務一")).toBeInTheDocument();
  });

  // ── MANAGER role ───────────────────────────────────────────────────────────

  it("MANAGER: renders tasks and shows assignee names", async () => {
    mockFetch.mockImplementation(makeFetchSuccess());

    await act(async () => {
      await renderWidget("MANAGER");
    });

    await waitFor(() => {
      expect(screen.getByText("升級任務一")).toBeInTheDocument();
    });

    // Assignee names SHOULD be shown for MANAGER
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.getByText(/Charlie/)).toBeInTheDocument();
  });

  // ── ADMIN role ─────────────────────────────────────────────────────────────

  it("ADMIN: renders all tasks with assignee names", async () => {
    mockFetch.mockImplementation(makeFetchSuccess());

    await act(async () => {
      await renderWidget("ADMIN");
    });

    await waitFor(() => {
      expect(screen.getByText("升級任務一")).toBeInTheDocument();
    });

    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /進行中/ })).toHaveLength(3);
  });

  // ── Level grouping ─────────────────────────────────────────────────────────

  it("renders tasks grouped by severity level", async () => {
    mockFetch.mockImplementation(makeFetchSuccess());

    await act(async () => {
      await renderWidget("MANAGER");
    });

    await waitFor(() => {
      expect(screen.getByText(/升級警示/)).toBeInTheDocument();
    });

    expect(screen.getByText(/停滯警告/)).toBeInTheDocument();
    expect(screen.getByText(/停滯提醒/)).toBeInTheDocument();
  });

  // ── Empty state ────────────────────────────────────────────────────────────

  it("shows empty state when no stale tasks", async () => {
    mockFetch.mockImplementation(makeFetchSuccess([]));

    await act(async () => {
      await renderWidget("ENGINEER");
    });

    await waitFor(() => {
      expect(
        screen.getByText("目前沒有停滯任務 ✅")
      ).toBeInTheDocument();
    });
  });

  // ── Error state ────────────────────────────────────────────────────────────

  it("shows error message and retry button on fetch failure", async () => {
    mockFetch.mockImplementation(makeFetchError());

    await act(async () => {
      await renderWidget("ENGINEER");
    });

    await waitFor(() => {
      expect(screen.getByText("伺服器錯誤")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "重新載入停滯工作" })).toBeInTheDocument();
  });

  it("retries fetch when retry button is clicked", async () => {
    // First call fails, second succeeds
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: "伺服器錯誤" }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { tasks: [], total: 0 } }),
      } as Response);

    await act(async () => {
      await renderWidget("ENGINEER");
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "重新載入停滯工作" })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "重新載入停滯工作" }));
    });

    await waitFor(() => {
      expect(screen.getByText("目前沒有停滯任務 ✅")).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // ── Mark as in-progress ────────────────────────────────────────────────────

  it("calls PATCH /api/tasks/:id when mark-in-progress is clicked", async () => {
    // GET: load tasks; PATCH: update task; GET: refresh
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { tasks: STALE_TASKS, total: 3 } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, data: { id: "task-esc-1", status: "IN_PROGRESS" } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { tasks: STALE_TASKS.slice(1), total: 2 } }),
      } as Response);

    await act(async () => {
      await renderWidget("MANAGER");
    });

    await waitFor(() => {
      expect(screen.getByText("升級任務一")).toBeInTheDocument();
    });

    const markButtons = screen.getAllByRole("button", { name: /將任務「升級任務一」標記為進行中/ });
    expect(markButtons).toHaveLength(1);

    await act(async () => {
      fireEvent.click(markButtons[0]);
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("任務已更新為進行中");
    });

    // Verify PATCH was called with correct body
    const patchCall = mockFetch.mock.calls.find(
      (call) => call[0] === "/api/tasks/task-esc-1"
    );
    expect(patchCall).toBeDefined();
    expect(JSON.parse(patchCall?.[1]?.body)).toEqual({ status: "IN_PROGRESS" });
  });

  it("shows error toast when mark-in-progress fails", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { tasks: [STALE_TASKS[0]], total: 1 } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: "無權限更新此任務" }),
      } as unknown as Response);

    await act(async () => {
      await renderWidget("MANAGER");
    });

    await waitFor(() => {
      expect(screen.getByText("升級任務一")).toBeInTheDocument();
    });

    const markButton = screen.getByRole("button", {
      name: /將任務「升級任務一」標記為進行中/,
    });

    await act(async () => {
      fireEvent.click(markButton);
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("無權限更新此任務");
    });
  });

  // ── Accessibility ──────────────────────────────────────────────────────────

  it("task links have descriptive aria-labels", async () => {
    mockFetch.mockImplementation(makeFetchSuccess([STALE_TASKS[0]]));

    await act(async () => {
      await renderWidget("MANAGER");
    });

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /前往任務：升級任務一/ })
      ).toBeInTheDocument();
    });
  });
});
