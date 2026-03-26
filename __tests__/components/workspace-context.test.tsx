/**
 * WorkspaceContext + Unified Workspace Tests — Issue #961
 */

import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), forward: jest.fn(), refresh: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "/work",
  useSearchParams: () => mockSearchParams,
  useServerInsertedHTML: jest.fn(),
  ServerInsertedHTMLContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
}));

jest.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "u1", role: "MANAGER" } } }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// ── Imports (after mocks) ────────────────────────────────────────────────────

import {
  WorkspaceProvider,
  useWorkspace,
  type WorkspaceViewMode,
} from "@/lib/workspace-context";
import {
  ViewSwitcher,
  ConnectedViewSwitcher,
  WorkspaceShell,
  VIEW_TABS,
} from "@/app/components/workspace/workspace-context";

// ── Test Helper Component ────────────────────────────────────────────────────

function TestConsumer() {
  const ws = useWorkspace();
  return (
    <div>
      <span data-testid="view-mode">{ws.viewMode}</span>
      <span data-testid="task-count">{ws.tasks.length}</span>
      <span data-testid="loading">{ws.loading ? "true" : "false"}</span>
      <span data-testid="has-filters">{ws.hasActiveFilters ? "true" : "false"}</span>
      <button data-testid="set-kanban" onClick={() => ws.setViewMode("kanban")}>
        kanban
      </button>
      <button data-testid="set-list" onClick={() => ws.setViewMode("list")}>
        list
      </button>
      <button data-testid="set-gantt" onClick={() => ws.setViewMode("gantt")}>
        gantt
      </button>
      <button
        data-testid="set-filter"
        onClick={() =>
          ws.setFilters({
            ...ws.filters,
            assignee: "u1",
          })
        }
      >
        filter
      </button>
      <button data-testid="refresh" onClick={() => ws.refresh()}>
        refresh
      </button>
    </div>
  );
}

function renderWithProvider(params?: URLSearchParams) {
  if (params) mockSearchParams = params;
  else mockSearchParams = new URLSearchParams();
  return render(
    <WorkspaceProvider>
      <TestConsumer />
    </WorkspaceProvider>
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("WorkspaceContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockFetch.mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/tasks")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            data: [
              { id: "t1", title: "Task 1", status: "IN_PROGRESS", priority: "P1", progressPct: 50, position: 1 },
              { id: "t2", title: "Task 2", status: "TODO", priority: "P2", progressPct: 0, dueDate: "2026-04-01", position: 2 },
            ],
          }),
        } as Response;
      }
      if (url.includes("/api/users")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, data: [{ id: "u1", name: "Alice" }] }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });
  });

  it("defaults to kanban view when no URL param", async () => {
    renderWithProvider();
    expect(screen.getByTestId("view-mode")).toHaveTextContent("kanban");
  });

  it("reads view mode from URL param", async () => {
    renderWithProvider(new URLSearchParams("view=list"));
    expect(screen.getByTestId("view-mode")).toHaveTextContent("list");
  });

  it("reads gantt view from URL param", async () => {
    renderWithProvider(new URLSearchParams("view=gantt"));
    expect(screen.getByTestId("view-mode")).toHaveTextContent("gantt");
  });

  it("falls back to kanban for invalid view param", async () => {
    renderWithProvider(new URLSearchParams("view=invalid"));
    expect(screen.getByTestId("view-mode")).toHaveTextContent("kanban");
  });

  it("fetches tasks on mount", async () => {
    // Use plain object mock instead of Response constructor for jsdom compatibility
    mockFetch.mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("/api/tasks")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            data: [
              { id: "t1", title: "Task 1", status: "IN_PROGRESS", priority: "P1", progressPct: 50, position: 1 },
              { id: "t2", title: "Task 2", status: "TODO", priority: "P2", progressPct: 0, dueDate: "2026-04-01", position: 2 },
            ],
          }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ ok: true, data: [] }) } as Response;
    });

    await act(async () => {
      renderWithProvider();
    });
    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("task-count")).toHaveTextContent("2");
  });

  it("switches view mode and updates URL", async () => {
    renderWithProvider();
    await act(async () => {
      fireEvent.click(screen.getByTestId("set-list"));
    });
    expect(screen.getByTestId("view-mode")).toHaveTextContent("list");
    expect(mockReplace).toHaveBeenCalled();
    const calledUrl = mockReplace.mock.calls[0][0] as string;
    expect(calledUrl).toContain("view=list");
  });

  it("sets filter and updates URL", async () => {
    renderWithProvider();
    await act(async () => {
      fireEvent.click(screen.getByTestId("set-filter"));
    });
    expect(screen.getByTestId("has-filters")).toHaveTextContent("true");
    expect(mockReplace).toHaveBeenCalled();
    const calledUrl = mockReplace.mock.calls[0][0] as string;
    expect(calledUrl).toContain("assignee=u1");
  });

  it("reads initial filters from URL params", async () => {
    renderWithProvider(new URLSearchParams("view=kanban&priority=P0"));
    // The fetch should include the priority param
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    const taskCall = mockFetch.mock.calls.find((c) =>
      (typeof c[0] === "string" ? c[0] : "").includes("/api/tasks")
    );
    expect(taskCall).toBeDefined();
    expect(String(taskCall![0])).toContain("priority=P0");
  });

  it("refresh re-fetches tasks", async () => {
    renderWithProvider();
    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    const callCount = mockFetch.mock.calls.filter((c) =>
      (typeof c[0] === "string" ? c[0] : "").includes("/api/tasks")
    ).length;

    await act(async () => {
      fireEvent.click(screen.getByTestId("refresh"));
    });

    await waitFor(() => {
      const newCount = mockFetch.mock.calls.filter((c) =>
        (typeof c[0] === "string" ? c[0] : "").includes("/api/tasks")
      ).length;
      expect(newCount).toBeGreaterThan(callCount);
    });
  });

  it("useWorkspace throws when used outside provider", () => {
    // Suppress React error boundary noise
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      "useWorkspace must be used within <WorkspaceProvider>"
    );
    spy.mockRestore();
  });
});

describe("WorkspaceTableView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders table with task rows", async () => {
    const { WorkspaceTableView } = await import(
      "@/app/components/workspace-table-view"
    );
    const tasks = [
      {
        id: "t1",
        title: "First Task",
        status: "IN_PROGRESS",
        priority: "P1",
        progressPct: 50,
        primaryAssignee: { name: "Alice" },
      },
      {
        id: "t2",
        title: "Second Task",
        status: "TODO",
        priority: "P2",
        progressPct: 0,
        dueDate: "2026-04-01",
      },
    ] as any;

    const onTaskClick = jest.fn();
    render(<WorkspaceTableView tasks={tasks} onTaskClick={onTaskClick} />);

    expect(screen.getByText("First Task")).toBeInTheDocument();
    expect(screen.getByText("Second Task")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();

    // Click a row
    fireEvent.click(screen.getByText("First Task"));
    expect(onTaskClick).toHaveBeenCalledWith("t1");
  });

  it("shows empty message when no tasks", async () => {
    const { WorkspaceTableView } = await import(
      "@/app/components/workspace-table-view"
    );
    render(<WorkspaceTableView tasks={[]} onTaskClick={() => {}} />);
    expect(screen.getByText("無符合條件的任務")).toBeInTheDocument();
  });

  it("sorts by clicking column header", async () => {
    const { WorkspaceTableView } = await import(
      "@/app/components/workspace-table-view"
    );
    const tasks = [
      { id: "t1", title: "BBB", status: "TODO", priority: "P2", progressPct: 0 },
      { id: "t2", title: "AAA", status: "IN_PROGRESS", priority: "P1", progressPct: 50 },
    ] as any;

    render(<WorkspaceTableView tasks={tasks} onTaskClick={() => {}} />);

    // Click title header to sort by title asc
    fireEvent.click(screen.getByText("任務名稱"));
    const rows = screen.getAllByRole("row");
    // First data row should be AAA (alphabetical asc)
    expect(rows[1]).toHaveTextContent("AAA");
  });
});

// ── Issue #961: ViewSwitcher component tests ─────────────────────────────────

describe("ViewSwitcher", () => {
  it("renders three view tabs: 看板, 甘特, 列表", () => {
    const onChange = jest.fn();
    render(<ViewSwitcher viewMode="kanban" onViewModeChange={onChange} />);
    expect(screen.getByRole("tab", { name: /看板/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /甘特/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /列表/ })).toBeInTheDocument();
  });

  it("marks active tab as aria-selected", () => {
    const onChange = jest.fn();
    render(<ViewSwitcher viewMode="gantt" onViewModeChange={onChange} />);
    expect(screen.getByRole("tab", { name: /甘特/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /看板/ })).toHaveAttribute("aria-selected", "false");
  });

  it("fires onViewModeChange on tab click", () => {
    const onChange = jest.fn();
    render(<ViewSwitcher viewMode="kanban" onViewModeChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: /列表/ }));
    expect(onChange).toHaveBeenCalledWith("list");
  });

  it("has tablist role for accessibility", () => {
    render(<ViewSwitcher viewMode="kanban" onViewModeChange={jest.fn()} />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });
});

describe("VIEW_TABS config", () => {
  it("contains 3 modes: kanban, gantt, list", () => {
    expect(VIEW_TABS).toHaveLength(3);
    expect(VIEW_TABS.map((t) => t.mode)).toEqual(["kanban", "gantt", "list"]);
  });
});

describe("ConnectedViewSwitcher", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockFetch.mockImplementation(async () =>
      ({ ok: true, status: 200, json: async () => ({ ok: true, data: [] }) } as Response)
    );
  });

  it("renders inside WorkspaceProvider and reads view mode", async () => {
    render(
      <WorkspaceProvider>
        <ConnectedViewSwitcher />
        <TestConsumer />
      </WorkspaceProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId("view-mode")).toHaveTextContent("kanban");
    });
    // Click gantt tab
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /甘特/ }));
    });
    expect(screen.getByTestId("view-mode")).toHaveTextContent("gantt");
  });
});

describe("WorkspaceShell", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockFetch.mockImplementation(async () =>
      ({ ok: true, status: 200, json: async () => ({ ok: true, data: [] }) } as Response)
    );
  });

  it("wraps children with provider and suspense", async () => {
    render(
      <WorkspaceShell>
        <div data-testid="child">Hello</div>
      </WorkspaceShell>
    );
    expect(await screen.findByTestId("child")).toBeInTheDocument();
  });
});

describe("WorkspaceFilterBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockFetch.mockImplementation(async () =>
      ({ ok: true, status: 200, json: async () => ({ ok: true, data: [] }) } as Response)
    );
  });

  it("renders filter controls", async () => {
    const { WorkspaceFilterBar } = await import(
      "@/app/components/workspace-filters"
    );
    render(
      <WorkspaceProvider>
        <WorkspaceFilterBar />
      </WorkspaceProvider>
    );

    expect(screen.getByLabelText("篩選負責人")).toBeInTheDocument();
    expect(screen.getByLabelText("篩選狀態")).toBeInTheDocument();
    expect(screen.getByLabelText("篩選優先度")).toBeInTheDocument();
    expect(screen.getByLabelText("篩選分類")).toBeInTheDocument();
  });
});
