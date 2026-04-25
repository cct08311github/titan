/**
 * @jest-environment jsdom
 */
/**
 * Component tests: DailyDigestBanner (Issue #1539-7)
 *
 * Backstops the integration that #1539-7 added — element was dead code
 * since #963 because it was never imported into a page. These tests guard
 * the contract so future refactors don't silently break it again.
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DailyDigestBanner } from "@/app/components/timesheet/daily-digest-banner";

const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock("lucide-react", () => ({
  Clock: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-clock" {...props} />,
  Check: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-check" {...props} />,
  ChevronDown: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-down" {...props} />,
  ChevronUp: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-up" {...props} />,
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-x" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-loader" {...props} />,
}));

const SUGGESTION_PAYLOAD = {
  data: [
    {
      id: "s1",
      taskId: "t1",
      taskTitle: "Refactor billing API",
      type: "time_entry",
      suggestedHours: 2.5,
      date: "2026-04-25",
      startedAt: "2026-04-25T10:00:00Z",
      completedAt: "2026-04-25T12:30:00Z",
      category: "PLANNED_TASK",
      alreadyLogged: false,
    },
    {
      id: "s2",
      taskId: "t2",
      taskTitle: "Production hotfix",
      type: "time_entry",
      suggestedHours: 1,
      date: "2026-04-25",
      startedAt: null,
      completedAt: "2026-04-25T15:00:00Z",
      category: "INCIDENT",
      alreadyLogged: false,
    },
    {
      id: "s3",
      taskId: "t3",
      taskTitle: "Already-logged task",
      type: "time_entry",
      suggestedHours: 1,
      date: "2026-04-25",
      startedAt: null,
      completedAt: null,
      category: "ADMIN",
      alreadyLogged: true, // should be filtered out
    },
  ],
};

describe("DailyDigestBanner — integration backstop", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(SUGGESTION_PAYLOAD),
    });
  });

  it("renders nothing during initial loading", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<DailyDigestBanner />);
    expect(screen.queryByText(/今天有/)).not.toBeInTheDocument();
  });

  it("renders nothing when API returns empty array", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [] }) });
    render(<DailyDigestBanner />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(screen.queryByText(/今天有/)).not.toBeInTheDocument();
  });

  it("renders banner with pending suggestion count (excludes alreadyLogged)", async () => {
    render(<DailyDigestBanner />);
    await waitFor(() => {
      expect(screen.getByText(/今天有 2 筆工時建議待確認/)).toBeInTheDocument();
    });
  });

  it("expands to show suggestion details on chevron click", async () => {
    render(<DailyDigestBanner />);
    await waitFor(() => screen.getByText(/今天有 2 筆/));
    fireEvent.click(screen.getByLabelText("展開"));
    expect(screen.getByText("Refactor billing API")).toBeInTheDocument();
    expect(screen.getByText("Production hotfix")).toBeInTheDocument();
  });

  it("calls confirm-suggestions endpoint with selected entries", async () => {
    render(<DailyDigestBanner />);
    await waitFor(() => screen.getByText(/今天有 2 筆/));

    const confirmBtn = screen.getByText(/確認 2 筆/);
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      const calls = mockFetch.mock.calls;
      const confirmCall = calls.find(([url]) => (url as string).includes("/confirm-suggestions"));
      expect(confirmCall).toBeDefined();
      const body = JSON.parse((confirmCall![1] as RequestInit).body as string);
      expect(body.suggestions).toHaveLength(2);
      expect(body.suggestions[0]).toMatchObject({
        taskId: "t1",
        hours: 2.5,
        category: "PLANNED_TASK",
      });
    });
  });

  it("hides banner after dismiss button clicked", async () => {
    render(<DailyDigestBanner />);
    await waitFor(() => screen.getByText(/今天有 2 筆/));
    fireEvent.click(screen.getByLabelText("關閉"));
    expect(screen.queryByText(/今天有 2 筆/)).not.toBeInTheDocument();
  });

  it("silently ignores fetch errors (banner is non-critical)", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));
    render(<DailyDigestBanner />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(screen.queryByText(/今天有/)).not.toBeInTheDocument();
  });
});
