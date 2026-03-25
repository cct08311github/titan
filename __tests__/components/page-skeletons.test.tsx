/**
 * Tests for page skeleton components (Task 23 — Issue #780)
 * TDD: tests written first to define expected skeleton variants.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  DashboardSkeleton,
  KanbanSkeleton,
  TimesheetSkeleton,
  ReportSkeleton,
  PageSkeleton,
} from "@/app/components/page-states";

describe("Page Skeletons", () => {
  it("DashboardSkeleton renders stat card placeholders", () => {
    const { container } = render(<DashboardSkeleton />);
    // Should have animated pulse elements
    const pulses = container.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBeGreaterThanOrEqual(4);
  });

  it("KanbanSkeleton renders column placeholders", () => {
    const { container } = render(<KanbanSkeleton />);
    // Should render 5 kanban column skeletons
    const columns = container.querySelectorAll("[data-testid='kanban-col-skeleton']");
    expect(columns.length).toBe(5);
  });

  it("TimesheetSkeleton renders grid-like placeholders", () => {
    const { container } = render(<TimesheetSkeleton />);
    const pulses = container.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBeGreaterThanOrEqual(5);
  });

  it("ReportSkeleton renders tab and content placeholders", () => {
    const { container } = render(<ReportSkeleton />);
    const pulses = container.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBeGreaterThanOrEqual(3);
  });

  it("PageSkeleton renders a generic page skeleton with title and rows", () => {
    const { container } = render(<PageSkeleton />);
    const pulses = container.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBeGreaterThanOrEqual(4);
  });

  it("PageSkeleton accepts custom rows prop", () => {
    const { container } = render(<PageSkeleton rows={10} />);
    const pulses = container.querySelectorAll(".animate-pulse");
    expect(pulses.length).toBeGreaterThanOrEqual(10);
  });
});
