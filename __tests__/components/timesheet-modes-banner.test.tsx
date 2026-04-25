/**
 * @jest-environment jsdom
 */
/**
 * Component tests: TimesheetModesBanner (Issue #1539-6)
 *
 * Covers:
 * - Hidden by default during SSR/first paint (no flash)
 * - Visible after mount when not dismissed
 * - Hidden when localStorage flag set
 * - Dismiss persists to localStorage
 * - Renders all 3 mode descriptions
 */
import React, { act } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TimesheetModesBanner } from "@/app/components/timesheet/timesheet-modes-banner";

jest.mock("lucide-react", () => ({
  Clock: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-clock" {...props} />,
  Zap: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-zap" {...props} />,
  Grid3X3: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-grid" {...props} />,
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-x" {...props} />,
}));

describe("TimesheetModesBanner", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders banner after mount when not dismissed", () => {
    render(<TimesheetModesBanner />);
    expect(screen.getByTestId("timesheet-modes-banner")).toBeInTheDocument();
  });

  it("does not render when localStorage flag is set", () => {
    window.localStorage.setItem("titan:timesheet:modes-banner-dismissed", "1");
    render(<TimesheetModesBanner />);
    expect(screen.queryByTestId("timesheet-modes-banner")).not.toBeInTheDocument();
  });

  it("renders all 3 mode descriptions", () => {
    render(<TimesheetModesBanner />);
    expect(screen.getByText("正在做事")).toBeInTheDocument();
    expect(screen.getByText("剛做完一件事")).toBeInTheDocument();
    expect(screen.getByText("補登整週")).toBeInTheDocument();
  });

  it("dismiss persists to localStorage and hides banner", () => {
    render(<TimesheetModesBanner />);
    expect(screen.getByTestId("timesheet-modes-banner")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("timesheet-modes-banner-dismiss"));

    expect(screen.queryByTestId("timesheet-modes-banner")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("titan:timesheet:modes-banner-dismissed")).toBe("1");
  });

  it("does not re-show after dismiss + remount", () => {
    const { unmount } = render(<TimesheetModesBanner />);
    fireEvent.click(screen.getByTestId("timesheet-modes-banner-dismiss"));
    unmount();

    render(<TimesheetModesBanner />);
    expect(screen.queryByTestId("timesheet-modes-banner")).not.toBeInTheDocument();
  });

  it("renders the 三種記時模式 heading", () => {
    render(<TimesheetModesBanner />);
    expect(screen.getByText(/三種記時模式/)).toBeInTheDocument();
  });
});
