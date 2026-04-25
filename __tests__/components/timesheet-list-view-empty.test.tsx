/**
 * @jest-environment jsdom
 */
/**
 * Component tests: TimesheetListView empty state (Issue #1539-9)
 *
 * Mobile users auto-switch to list view, so this view's empty state is the
 * first surface a brand-new mobile user sees. Original showed plain text
 * "本週尚無工時記錄" with no CTA — dead-end.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TimesheetListView } from "@/app/components/timesheet-list-view";

jest.mock("lucide-react", () => ({
  Plus: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-plus" {...props} />,
}));

jest.mock("@/lib/safe-number", () => ({
  safeFixed: (n: number, d: number) => (n ?? 0).toFixed(d),
}));

describe("TimesheetListView empty state", () => {
  it("renders 'no entries' text when entries empty", () => {
    render(<TimesheetListView entries={[]} />);
    expect(screen.getByText("本週尚無工時記錄")).toBeInTheDocument();
  });

  it("does not render quick-log CTA when onQuickLog not provided", () => {
    render(<TimesheetListView entries={[]} />);
    expect(screen.queryByTestId("list-view-empty-quick-log")).not.toBeInTheDocument();
  });

  it("renders quick-log CTA when onQuickLog provided", () => {
    const onQuickLog = jest.fn();
    render(<TimesheetListView entries={[]} onQuickLog={onQuickLog} />);
    expect(screen.getByTestId("list-view-empty-quick-log")).toBeInTheDocument();
    expect(screen.getByText("快速記時數")).toBeInTheDocument();
  });

  it("calls onQuickLog when CTA clicked", () => {
    const onQuickLog = jest.fn();
    render(<TimesheetListView entries={[]} onQuickLog={onQuickLog} />);
    fireEvent.click(screen.getByTestId("list-view-empty-quick-log"));
    expect(onQuickLog).toHaveBeenCalledTimes(1);
  });

  it("does not show empty state when entries exist", () => {
    render(
      <TimesheetListView
        entries={[
          {
            id: "e1",
            date: "2026-04-25",
            hours: 8,
            category: "PLANNED_TASK",
            description: "test",
          } as never,
        ]}
        onQuickLog={jest.fn()}
      />
    );
    expect(screen.queryByText("本週尚無工時記錄")).not.toBeInTheDocument();
    expect(screen.queryByTestId("list-view-empty-quick-log")).not.toBeInTheDocument();
  });
});
