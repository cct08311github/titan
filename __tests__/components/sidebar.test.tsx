/**
 * Component tests: Sidebar — Updated for 5-experience-group restructure (Issue #970)
 */
import React from "react";
import { screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { render } from "@/__tests__/utils/test-utils";

jest.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "u1", role: "MANAGER" } }, status: "authenticated" }),
}));

const mockUsePathname = jest.fn(() => "/dashboard");
jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

import { Sidebar } from "@/app/components/sidebar";

// Mock window.matchMedia (not available in jsdom)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

jest.mock("next/link", () => {
  const MockLink = ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

describe("Sidebar", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/dashboard");
  });

  it("renders TITAN brand logo", () => {
    render(<Sidebar />);
    expect(screen.getByText("TITAN")).toBeInTheDocument();
  });

  it("renders all navigation items from 5 experience groups", () => {
    render(<Sidebar />);
    // My Day group (Manager gets cockpit + 今日總覽)
    expect(screen.getByText("駕駛艙")).toBeInTheDocument();
    expect(screen.getByText("今日總覽")).toBeInTheDocument();
    // Big Picture
    expect(screen.getByText("年度計畫")).toBeInTheDocument();
    expect(screen.getByText("KPI")).toBeInTheDocument();
    expect(screen.getByText("甘特圖")).toBeInTheDocument();
    // Get It Done
    expect(screen.getByText("任務看板")).toBeInTheDocument();
    expect(screen.getByText("團隊動態")).toBeInTheDocument();
    // Track Time
    expect(screen.getByText("工時紀錄")).toBeInTheDocument();
    expect(screen.getByText("報表分析")).toBeInTheDocument();
    // Know More
    expect(screen.getByText("知識庫")).toBeInTheDocument();
  });

  it("marks dashboard link as active when on dashboard path", () => {
    render(<Sidebar />);
    const dashboardLink = screen.getByText("今日總覽").closest("a");
    expect(dashboardLink?.className).toContain("bg-[hsl(var(--sidebar-accent))]");
  });

  it("does not mark kanban as active when on dashboard", () => {
    render(<Sidebar />);
    const dashboardLink = screen.getByText("今日總覽").closest("a");
    const kanbanLink = screen.getByText("任務看板").closest("a");
    expect(dashboardLink?.className).toContain("bg-[hsl(var(--sidebar-accent))]");
    expect(kanbanLink?.className).not.toContain("font-medium");
  });

  it("marks kanban link as active when on kanban path", () => {
    mockUsePathname.mockReturnValue("/kanban");
    render(<Sidebar />);
    const kanbanLink = screen.getByText("任務看板").closest("a");
    expect(kanbanLink?.className).toContain("bg-[hsl(var(--sidebar-accent))]");
  });

  it("renders navigation links with correct hrefs", () => {
    render(<Sidebar />);
    const dashboardLink = screen.getByText("今日總覽").closest("a");
    expect(dashboardLink).toHaveAttribute("href", "/dashboard");
    const kpiLink = screen.getByText("KPI").closest("a");
    expect(kpiLink).toHaveAttribute("href", "/kpi");
  });
});
