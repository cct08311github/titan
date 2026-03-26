/**
 * @jest-environment jsdom
 */
/**
 * CalendarMonthView Tests — Issue #966
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "u1", role: "MANAGER" } } }),
}));

jest.mock("@/lib/api-client", () => ({
  extractItems: (body: { data?: unknown[] }) =>
    Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [],
}));

import { CalendarMonthView } from "@/app/components/timesheet/calendar-month-view";

describe("CalendarMonthView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/api/time-entries")) {
        return { ok: true, json: () => Promise.resolve({ ok: true, data: [
          { id: "e1", date: "2026-03-02", hours: 7.5 },
          { id: "e2", date: "2026-03-02", hours: 1 },
          { id: "e3", date: "2026-03-10", hours: 9 },
          { id: "e4", date: "2026-03-15", hours: 11 },
        ]})};
      }
      if (url.includes("/api/users")) {
        return { ok: true, json: () => Promise.resolve({ ok: true, data: [
          { id: "u1", name: "Alice" }, { id: "u2", name: "Bob" },
        ]})};
      }
      return { ok: true, json: () => Promise.resolve({ ok: true, data: [] }) };
    });
  });

  it("renders month navigation buttons", () => {
    render(<CalendarMonthView onDayClick={jest.fn()} />);
    expect(screen.getByLabelText("上個月")).toBeInTheDocument();
    expect(screen.getByLabelText("下個月")).toBeInTheDocument();
    expect(screen.getByText("本月")).toBeInTheDocument();
  });

  it("renders weekday headers", () => {
    render(<CalendarMonthView onDayClick={jest.fn()} />);
    expect(screen.getByText("一")).toBeInTheDocument();
    expect(screen.getByText("五")).toBeInTheDocument();
    expect(screen.getByText("日")).toBeInTheDocument();
  });

  it("renders day cells for current month", () => {
    render(<CalendarMonthView onDayClick={jest.fn()} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("28")).toBeInTheDocument();
  });

  it("navigates to previous month", () => {
    render(<CalendarMonthView onDayClick={jest.fn()} />);
    const now = new Date();
    fireEvent.click(screen.getByLabelText("上個月"));
    const prevMonth = now.getMonth();
    const expectedYear = prevMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const expectedMonth = prevMonth === 0 ? 12 : prevMonth;
    expect(screen.getByText(`${expectedYear} 年 ${expectedMonth} 月`)).toBeInTheDocument();
  });

  it("calls onDayClick when a day cell is clicked", () => {
    const onClick = jest.fn();
    render(<CalendarMonthView onDayClick={onClick} />);
    fireEvent.click(screen.getByText("15"));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0][0]).toBeInstanceOf(Date);
    expect(onClick.mock.calls[0][0].getDate()).toBe(15);
  });

  it("renders manager team member selector", async () => {
    render(<CalendarMonthView onDayClick={jest.fn()} />);
    await waitFor(() => { expect(screen.getByLabelText("選擇成員")).toBeInTheDocument(); });
  });

  it("shows color legend", () => {
    render(<CalendarMonthView onDayClick={jest.fn()} />);
    expect(screen.getByText("0h")).toBeInTheDocument();
    expect(screen.getByText("≤8h")).toBeInTheDocument();
    expect(screen.getByText(">8h")).toBeInTheDocument();
    expect(screen.getByText(">10h")).toBeInTheDocument();
  });

  it("renders monthly total", () => {
    render(<CalendarMonthView onDayClick={jest.fn()} />);
    expect(screen.getByText("月計：")).toBeInTheDocument();
  });
});
