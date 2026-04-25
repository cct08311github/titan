/**
 * @jest-environment jsdom
 */
/**
 * Component tests: TopTasksSuggestion (Issue #1539-4)
 *
 * Covers:
 * - Hidden when fetch fails or returns empty
 * - Renders collapsed by default
 * - Expand/collapse persists to localStorage
 * - +1h click calls onSave with today's date and 1 hour
 * - Maps task category to TimeCategory enum
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TopTasksSuggestion } from "@/app/components/timesheet/top-tasks-suggestion";

const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock("lucide-react", () => ({
  Lightbulb: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-bulb" {...props} />,
  Plus: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-plus" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-loader" {...props} />,
  ChevronDown: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-down" {...props} />,
  ChevronRight: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-right" {...props} />,
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/lib/api-client", () => ({
  extractData: (body: { data?: unknown }) => body?.data ?? body ?? null,
}));

const TASKS_PAYLOAD = {
  data: {
    items: [
      { taskId: "t1", taskTitle: "Refactor API layer", category: "PLANNED", totalHours: 12, entryCount: 4, avgHoursPerEntry: 3, lastEntryDate: "2026-04-22" },
      { taskId: "t2", taskTitle: "Production bug fix", category: "INCIDENT", totalHours: 5, entryCount: 2, avgHoursPerEntry: 2.5, lastEntryDate: "2026-04-21" },
    ],
    windowDays: 14,
  },
};

function renderComponent({ saveError = false }: { saveError?: boolean } = {}) {
  const onLogged = jest.fn();
  const onSave = jest.fn().mockImplementation(async () => {
    if (saveError) throw new Error("save failed");
  });
  render(<TopTasksSuggestion onLogged={onLogged} onSave={onSave} />);
  return { onLogged, onSave };
}

describe("TopTasksSuggestion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(TASKS_PAYLOAD),
    });
  });

  it("renders nothing while loading", () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    renderComponent();
    expect(screen.queryByTestId("top-tasks-suggestion")).not.toBeInTheDocument();
  });

  it("renders nothing when API returns empty", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { items: [], windowDays: 14 } }),
    });
    renderComponent();
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("top-tasks-suggestion")).not.toBeInTheDocument();
  });

  it("renders nothing when fetch fails (silent fallback)", async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: "boom" }) });
    renderComponent();
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("top-tasks-suggestion")).not.toBeInTheDocument();
  });

  it("renders header with task count when data loaded", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId("top-tasks-suggestion")).toBeInTheDocument();
    });
    expect(screen.getByText(/2 個任務/)).toBeInTheDocument();
  });

  it("starts collapsed by default", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId("top-tasks-suggestion")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("top-tasks-list")).not.toBeInTheDocument();
  });

  it("expands when toggle clicked, persists to localStorage", async () => {
    renderComponent();
    await waitFor(() => screen.getByTestId("top-tasks-toggle"));
    fireEvent.click(screen.getByTestId("top-tasks-toggle"));
    expect(screen.getByTestId("top-tasks-list")).toBeInTheDocument();
    expect(window.localStorage.getItem("titan:topTasks:expanded")).toBe("1");
  });

  it("restores expanded state from localStorage", async () => {
    window.localStorage.setItem("titan:topTasks:expanded", "1");
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId("top-tasks-list")).toBeInTheDocument();
    });
  });

  it("renders task chips with title and stats when expanded", async () => {
    window.localStorage.setItem("titan:topTasks:expanded", "1");
    renderComponent();
    await waitFor(() => screen.getByText("Refactor API layer"));
    expect(screen.getByText("Production bug fix")).toBeInTheDocument();
    expect(screen.getByText(/14 天累計 12.0h/)).toBeInTheDocument();
  });

  it("calls onSave with today's date when +1h clicked", async () => {
    window.localStorage.setItem("titan:topTasks:expanded", "1");
    const { onSave, onLogged } = renderComponent();
    await waitFor(() => screen.getByTestId("top-tasks-log-t1"));

    fireEvent.click(screen.getByTestId("top-tasks-log-t1"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        "t1",
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), // today
        1,
        "PLANNED_TASK", // mapped from "PLANNED"
      );
    });
    await waitFor(() => {
      expect(onLogged).toHaveBeenCalled();
    });
  });

  it("maps INCIDENT category correctly", async () => {
    window.localStorage.setItem("titan:topTasks:expanded", "1");
    const { onSave } = renderComponent();
    await waitFor(() => screen.getByTestId("top-tasks-log-t2"));

    fireEvent.click(screen.getByTestId("top-tasks-log-t2"));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        "t2",
        expect.any(String),
        1,
        "INCIDENT",
      );
    });
  });

  it("calls fetch with default params (days=14, limit=5)", async () => {
    renderComponent();
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("days=14");
    expect(url).toContain("limit=5");
  });

  it("does not call onLogged when save fails", async () => {
    window.localStorage.setItem("titan:topTasks:expanded", "1");
    const { onSave, onLogged } = renderComponent({ saveError: true });
    await waitFor(() => screen.getByTestId("top-tasks-log-t1"));

    fireEvent.click(screen.getByTestId("top-tasks-log-t1"));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onLogged).not.toHaveBeenCalled();
  });
});
