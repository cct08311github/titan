/**
 * @jest-environment jsdom
 */
/**
 * Component tests: WeekCompletionCelebration (Issue #1539-5)
 *
 * Covers:
 * - Fires toast when crossing 40h threshold for the first time this week
 * - One-shot per week (persists to localStorage)
 * - Doesn't fire on subsequent renders / re-mounts after threshold met
 * - Doesn't fire if already at/above threshold on mount (no cross-over)
 * - Per-week ledger keyed by weekStartIso (different week → fresh trigger)
 */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WeekCompletionCelebration } from "@/app/components/timesheet/week-completion-celebration";

const mockToastSuccess = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

jest.mock("@/lib/safe-number", () => ({
  safeFixed: (n: number, d: number) => (n ?? 0).toFixed(d),
}));

describe("WeekCompletionCelebration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  it("does not fire when total stays below threshold", () => {
    render(<WeekCompletionCelebration weeklyTotal={20} weekStartIso="2026-04-20" />);
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("does not fire when starting at/above threshold (no cross-over)", () => {
    render(<WeekCompletionCelebration weeklyTotal={45} weekStartIso="2026-04-20" />);
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("fires toast when crossing 40h threshold for the first time", () => {
    const { rerender } = render(
      <WeekCompletionCelebration weeklyTotal={38} weekStartIso="2026-04-20" />
    );
    expect(mockToastSuccess).not.toHaveBeenCalled();

    rerender(<WeekCompletionCelebration weeklyTotal={41} weekStartIso="2026-04-20" />);
    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess.mock.calls[0][0]).toContain("41.0");
    expect(mockToastSuccess.mock.calls[0][0]).toContain("週末快樂");
  });

  it("persists fired state to localStorage", () => {
    const { rerender } = render(
      <WeekCompletionCelebration weeklyTotal={38} weekStartIso="2026-04-20" />
    );
    rerender(<WeekCompletionCelebration weeklyTotal={42} weekStartIso="2026-04-20" />);

    expect(window.localStorage.getItem("titan:timesheet:celebrated:2026-04-20")).toBe("1");
  });

  it("does not fire again after celebration recorded (same week, re-mount)", () => {
    window.localStorage.setItem("titan:timesheet:celebrated:2026-04-20", "1");
    const { rerender } = render(
      <WeekCompletionCelebration weeklyTotal={38} weekStartIso="2026-04-20" />
    );
    rerender(<WeekCompletionCelebration weeklyTotal={45} weekStartIso="2026-04-20" />);
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("fires fresh toast for a new week", () => {
    // Last week was celebrated
    window.localStorage.setItem("titan:timesheet:celebrated:2026-04-13", "1");

    // This week (different weekStart) crosses threshold
    const { rerender } = render(
      <WeekCompletionCelebration weeklyTotal={38} weekStartIso="2026-04-20" />
    );
    rerender(<WeekCompletionCelebration weeklyTotal={42} weekStartIso="2026-04-20" />);

    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
  });

  it("respects custom threshold", () => {
    const { rerender } = render(
      <WeekCompletionCelebration weeklyTotal={28} weekStartIso="2026-04-20" threshold={30} />
    );
    rerender(<WeekCompletionCelebration weeklyTotal={32} weekStartIso="2026-04-20" threshold={30} />);
    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
  });

  it("does not fire when total dips below then bounces back to same value", () => {
    // Start: 41 (already above; first render just sets the ref)
    const { rerender } = render(
      <WeekCompletionCelebration weeklyTotal={41} weekStartIso="2026-04-20" />
    );
    expect(mockToastSuccess).not.toHaveBeenCalled(); // no cross-over yet

    // Dip below (e.g. user deletes an entry)
    rerender(<WeekCompletionCelebration weeklyTotal={38} weekStartIso="2026-04-20" />);

    // Cross over again
    rerender(<WeekCompletionCelebration weeklyTotal={41} weekStartIso="2026-04-20" />);

    // Now expected to celebrate this time (it crossed again from below)
    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
  });

  it("doesn't double-fire when localStorage already has the key (race-safe)", () => {
    // Pre-existing celebration entry from a previous session
    window.localStorage.setItem("titan:timesheet:celebrated:2026-04-20", "1");

    const { rerender } = render(
      <WeekCompletionCelebration weeklyTotal={20} weekStartIso="2026-04-20" />
    );
    rerender(<WeekCompletionCelebration weeklyTotal={45} weekStartIso="2026-04-20" />);
    rerender(<WeekCompletionCelebration weeklyTotal={50} weekStartIso="2026-04-20" />);

    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("returns null (renders nothing visible)", () => {
    const { container } = render(
      <WeekCompletionCelebration weeklyTotal={20} weekStartIso="2026-04-20" />
    );
    expect(container.firstChild).toBeNull();
  });
});
