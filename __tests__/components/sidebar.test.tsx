/**
 * Component tests: Sidebar
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Sidebar } from "@/app/components/sidebar";

jest.mock("next/link", () => {
  const MockLink = ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

const mockUsePathname = jest.fn(() => "/dashboard");
jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/dashboard");
  });

  it("renders TITAN brand logo", () => {
    render(<Sidebar />);
    expect(screen.getByText("TITAN")).toBeInTheDocument();
  });

  it("renders all navigation items", () => {
    render(<Sidebar />);
    expect(screen.getByText("儀表板")).toBeInTheDocument();
    expect(screen.getByText("看板")).toBeInTheDocument();
    expect(screen.getByText("甘特圖")).toBeInTheDocument();
    expect(screen.getByText("知識庫")).toBeInTheDocument();
    expect(screen.getByText("工時紀錄")).toBeInTheDocument();
    expect(screen.getByText("KPI")).toBeInTheDocument();
    expect(screen.getByText("報表")).toBeInTheDocument();
    expect(screen.getByText("年度計畫")).toBeInTheDocument();
  });

  it("renders version footer", () => {
    render(<Sidebar />);
    expect(screen.getByText(/v1\.0\.0/)).toBeInTheDocument();
  });

  it("marks dashboard link as active when on dashboard path", () => {
    render(<Sidebar />);
    const dashboardLink = screen.getByText("儀表板").closest("a");
    expect(dashboardLink?.className).toContain("bg-sidebar-accent");
  });

  it("does not mark kanban as active when on dashboard", () => {
    render(<Sidebar />);
    const dashboardLink = screen.getByText("儀表板").closest("a");
    const kanbanLink = screen.getByText("看板").closest("a");
    // Dashboard should be active, kanban should not have the active (non-hover) class as a standalone class
    expect(dashboardLink?.className).toContain("bg-sidebar-accent");
    // Kanban is not active — it should not contain the font-medium active indicator
    expect(kanbanLink?.className).not.toContain("font-medium");
  });

  it("marks kanban link as active when on kanban path", () => {
    mockUsePathname.mockReturnValue("/kanban");
    render(<Sidebar />);
    const kanbanLink = screen.getByText("看板").closest("a");
    expect(kanbanLink?.className).toContain("bg-sidebar-accent");
  });

  it("renders navigation links with correct hrefs", () => {
    render(<Sidebar />);
    const dashboardLink = screen.getByText("儀表板").closest("a");
    expect(dashboardLink).toHaveAttribute("href", "/dashboard");
    const kpiLink = screen.getByText("KPI").closest("a");
    expect(kpiLink).toHaveAttribute("href", "/kpi");
  });
});
