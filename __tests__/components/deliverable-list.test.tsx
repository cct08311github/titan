/**
 * Component tests: DeliverableList
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DeliverableList } from "@/app/components/deliverable-list";

const mockFetch = jest.fn();
global.fetch = mockFetch;

const DELIVERABLES = [
  { id: "d1", title: "Design Document", type: "DOCUMENT" as const, status: "NOT_STARTED" as const },
  { id: "d2", title: "System Release", type: "SYSTEM" as const, status: "IN_PROGRESS" as const },
];

describe("DeliverableList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "d3", title: "New Del", type: "DOCUMENT", status: "NOT_STARTED" }),
    } as Response);
  });

  it("renders all deliverable titles", () => {
    render(<DeliverableList deliverables={DELIVERABLES} taskId="task-1" />);
    expect(screen.getByText("Design Document")).toBeInTheDocument();
    expect(screen.getByText("System Release")).toBeInTheDocument();
  });

  it("renders deliverable type labels", () => {
    render(<DeliverableList deliverables={DELIVERABLES} taskId="task-1" />);
    expect(screen.getByText("文件")).toBeInTheDocument();
    expect(screen.getByText("系統")).toBeInTheDocument();
  });

  it("renders status labels", () => {
    render(<DeliverableList deliverables={DELIVERABLES} taskId="task-1" />);
    expect(screen.getByText("未開始")).toBeInTheDocument();
    expect(screen.getByText("進行中")).toBeInTheDocument();
  });

  it("shows add deliverable button", () => {
    render(<DeliverableList deliverables={DELIVERABLES} taskId="task-1" />);
    expect(screen.getByText("新增交付項")).toBeInTheDocument();
  });

  it("shows add form when add button is clicked", () => {
    render(<DeliverableList deliverables={DELIVERABLES} taskId="task-1" />);
    fireEvent.click(screen.getByText("新增交付項"));
    expect(screen.getByPlaceholderText("交付項名稱...")).toBeInTheDocument();
  });

  it("hides add form when cancel is clicked", () => {
    render(<DeliverableList deliverables={DELIVERABLES} taskId="task-1" />);
    fireEvent.click(screen.getByText("新增交付項"));
    fireEvent.click(screen.getByText("取消"));
    expect(screen.queryByPlaceholderText("交付項名稱...")).not.toBeInTheDocument();
  });

  it("cycles status when status badge is clicked", async () => {
    const onUpdate = jest.fn();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    render(<DeliverableList deliverables={DELIVERABLES} taskId="task-1" onUpdate={onUpdate} />);
    await act(async () => {
      fireEvent.click(screen.getByText("未開始"));
    });
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/deliverables/d1",
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });

  it("adds deliverable on form submit", async () => {
    const onUpdate = jest.fn();
    render(<DeliverableList deliverables={DELIVERABLES} taskId="task-1" onUpdate={onUpdate} />);
    fireEvent.click(screen.getByText("新增交付項"));
    const input = screen.getByPlaceholderText("交付項名稱...");
    fireEvent.change(input, { target: { value: "New Del" } });
    await act(async () => {
      fireEvent.click(screen.getByText("新增"));
    });
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/deliverables",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("renders empty list gracefully", () => {
    render(<DeliverableList deliverables={[]} taskId="task-1" />);
    expect(screen.getByText("新增交付項")).toBeInTheDocument();
  });
});
