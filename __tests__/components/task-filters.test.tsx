/**
 * Component tests: TaskFilters — Issue #812 (K-4)
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  TaskFilters,
  emptyFilters,
  hasActiveFilters,
  parseFiltersFromUrl,
  serializeFiltersToUrl,
} from "@/app/components/task-filters";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: jest.fn() }),
  usePathname: () => "/kanban",
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("TaskFilters", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/users")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ok: true,
            data: { items: [{ id: "u1", name: "Alice" }, { id: "u2", name: "Bob" }] },
          }),
        });
      }
      if (url.includes("/api/tasks/tags")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            ok: true,
            data: { tags: [{ name: "維運", color: "#3B82F6" }, { name: "開發", color: "#10B981" }] },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  it("renders filter icon and label", async () => {
    await act(async () => {
      render(<TaskFilters filters={emptyFilters} onChange={jest.fn()} />);
    });
    expect(screen.getByText("篩選")).toBeInTheDocument();
  });

  it("renders priority select with options", async () => {
    await act(async () => {
      render(<TaskFilters filters={emptyFilters} onChange={jest.fn()} />);
    });
    expect(screen.getByText("所有優先度")).toBeInTheDocument();
    expect(screen.getByText("P0 緊急")).toBeInTheDocument();
  });

  it("renders category select with options", async () => {
    await act(async () => {
      render(<TaskFilters filters={emptyFilters} onChange={jest.fn()} />);
    });
    expect(screen.getByText("所有分類")).toBeInTheDocument();
    expect(screen.getByText("原始規劃")).toBeInTheDocument();
  });

  it("renders tag filter button", async () => {
    await act(async () => {
      render(<TaskFilters filters={emptyFilters} onChange={jest.fn()} />);
    });
    expect(screen.getByText("標籤")).toBeInTheDocument();
  });

  it("renders date range inputs", async () => {
    await act(async () => {
      render(<TaskFilters filters={emptyFilters} onChange={jest.fn()} />);
    });
    expect(screen.getByLabelText("到期日起始")).toBeInTheDocument();
    expect(screen.getByLabelText("到期日結束")).toBeInTheDocument();
  });

  it("does not show clear button when no active filters", async () => {
    await act(async () => {
      render(<TaskFilters filters={emptyFilters} onChange={jest.fn()} />);
    });
    expect(screen.queryByText("清除篩選")).not.toBeInTheDocument();
  });

  it("shows clear button when filter is active", async () => {
    await act(async () => {
      render(
        <TaskFilters
          filters={{ ...emptyFilters, assignee: "u1" }}
          onChange={jest.fn()}
        />
      );
    });
    expect(screen.getByText("清除篩選")).toBeInTheDocument();
  });

  it("shows clear button when tags are active", async () => {
    await act(async () => {
      render(
        <TaskFilters
          filters={{ ...emptyFilters, tags: ["維運"] }}
          onChange={jest.fn()}
        />
      );
    });
    expect(screen.getByText("清除篩選")).toBeInTheDocument();
  });

  it("calls onChange with cleared filters when clear is clicked", async () => {
    const handleChange = jest.fn();
    await act(async () => {
      render(
        <TaskFilters
          filters={{ ...emptyFilters, assignee: "u1", priority: "P0" }}
          onChange={handleChange}
        />
      );
    });
    fireEvent.click(screen.getByText("清除篩選"));
    expect(handleChange).toHaveBeenCalledWith(emptyFilters);
  });

  it("shows filter count when totalCount and filteredCount provided", async () => {
    await act(async () => {
      render(
        <TaskFilters
          filters={{ ...emptyFilters, priority: "P0" }}
          onChange={jest.fn()}
          totalCount={45}
          filteredCount={12}
        />
      );
    });
    expect(screen.getByText("顯示 12/45 筆任務")).toBeInTheDocument();
  });

  it("does not show filter count when no active filters", async () => {
    await act(async () => {
      render(
        <TaskFilters
          filters={emptyFilters}
          onChange={jest.fn()}
          totalCount={45}
          filteredCount={45}
        />
      );
    });
    expect(screen.queryByText(/筆任務/)).not.toBeInTheDocument();
  });
});

describe("hasActiveFilters", () => {
  it("returns false for empty filters", () => {
    expect(hasActiveFilters(emptyFilters)).toBe(false);
  });

  it("returns true when assignee set", () => {
    expect(hasActiveFilters({ ...emptyFilters, assignee: "u1" })).toBe(true);
  });

  it("returns true when tags set", () => {
    expect(hasActiveFilters({ ...emptyFilters, tags: ["維運"] })).toBe(true);
  });

  it("returns true when dueDateFrom set", () => {
    expect(hasActiveFilters({ ...emptyFilters, dueDateFrom: "2026-01-01" })).toBe(true);
  });
});

describe("URL serialization", () => {
  it("serializes filters to query string", () => {
    const qs = serializeFiltersToUrl({
      assignee: "u1",
      priority: "P0",
      category: "",
      tags: ["維運", "開發"],
      dueDateFrom: "2026-01-01",
      dueDateTo: "2026-12-31",
    });
    expect(qs).toContain("assignee=u1");
    expect(qs).toContain("priority=P0");
    expect(qs).not.toContain("category=");
    expect(qs).toContain("tags=");
    expect(qs).toContain("dueDateFrom=2026-01-01");
    expect(qs).toContain("dueDateTo=2026-12-31");
  });

  it("returns empty string for empty filters", () => {
    expect(serializeFiltersToUrl(emptyFilters)).toBe("");
  });

  it("parses filters from URL search params", () => {
    const params = new URLSearchParams("assignee=u1&priority=P0&tags=維運,開發&dueDateFrom=2026-01-01");
    const parsed = parseFiltersFromUrl(params);
    expect(parsed.assignee).toBe("u1");
    expect(parsed.priority).toBe("P0");
    expect(parsed.tags).toEqual(["維運", "開發"]);
    expect(parsed.dueDateFrom).toBe("2026-01-01");
    expect(parsed.dueDateTo).toBe("");
  });

  it("parses empty URL as empty filters", () => {
    const parsed = parseFiltersFromUrl(new URLSearchParams());
    expect(parsed).toEqual(emptyFilters);
  });
});
