/**
 * Tests for responsive improvements (Task 25 — Issue #785)
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// We test that the mobile nav includes all necessary items
// by checking the Topbar's MOBILE_NAV constant coverage

// Mock next-auth
jest.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { name: "Test", role: "ENGINEER" } }, status: "authenticated" }),
  signOut: jest.fn(),
}));

jest.mock("next/link", () => {
  const MockLink = ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

// Mock NotificationBell to avoid complex dependencies
jest.mock("@/app/components/notification-bell", () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

describe("Topbar mobile navigation", () => {
  it("renders hamburger menu button on mobile", async () => {
    const { Topbar } = await import("@/app/components/topbar");
    render(<Topbar />);
    expect(screen.getByLabelText("選單")).toBeInTheDocument();
  });
});

describe("Timesheet responsive behavior", () => {
  it("timesheet grid has overflow-x-auto wrapper for horizontal scroll", async () => {
    // This is a structural test to verify the grid component supports mobile scrolling
    const { TimesheetGrid } = await import("@/app/components/timesheet-grid");
    const { container } = render(
      <TimesheetGrid
        weekStart={new Date("2026-03-23")}
        taskRows={[{ taskId: null, label: "Test" }]}
        entries={[]}
        onCellSave={jest.fn()}
        onCellDelete={jest.fn()}
      />
    );
    const wrapper = container.querySelector(".overflow-x-auto");
    expect(wrapper).toBeInTheDocument();
  });
});
