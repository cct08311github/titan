/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
const mockFetch = jest.fn();
global.fetch = mockFetch;
jest.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { id: "u1", role: "MANAGER" } } }) }));
jest.mock("@/lib/api-client", () => ({ extractItems: (b: any) => Array.isArray(b?.data) ? b.data : Array.isArray(b) ? b : [] }));
import { CalendarMonthView } from "@/app/components/timesheet/calendar-month-view";

describe("CalendarMonthView", () => {
  beforeEach(() => { jest.clearAllMocks(); mockFetch.mockImplementation(async (url: string) => {
    if (url.includes("/api/time-entries")) return { ok: true, json: () => Promise.resolve({ ok: true, data: [{ id:"e1",date:"2026-03-02",hours:7.5 }] }) };
    if (url.includes("/api/users")) return { ok: true, json: () => Promise.resolve({ ok: true, data: [{id:"u1",name:"Alice"},{id:"u2",name:"Bob"}] }) };
    return { ok: true, json: () => Promise.resolve({ ok: true, data: [] }) };
  }); });
  it("renders month navigation", () => { render(<CalendarMonthView onDayClick={jest.fn()}/>); expect(screen.getByLabelText("上個月")).toBeInTheDocument(); expect(screen.getByLabelText("下個月")).toBeInTheDocument(); expect(screen.getByText("本月")).toBeInTheDocument(); });
  it("renders weekday headers", () => { render(<CalendarMonthView onDayClick={jest.fn()}/>); expect(screen.getByText("一")).toBeInTheDocument(); expect(screen.getByText("日")).toBeInTheDocument(); });
  it("renders day cells", () => { render(<CalendarMonthView onDayClick={jest.fn()}/>); expect(screen.getByText("1")).toBeInTheDocument(); expect(screen.getByText("28")).toBeInTheDocument(); });
  it("navigates prev month", () => { render(<CalendarMonthView onDayClick={jest.fn()}/>); const n=new Date(); fireEvent.click(screen.getByLabelText("上個月")); const pm=n.getMonth(); const ey=pm===0?n.getFullYear()-1:n.getFullYear(); const em=pm===0?12:pm; expect(screen.getByText(`${ey} 年 ${em} 月`)).toBeInTheDocument(); });
  it("calls onDayClick", () => { const fn=jest.fn(); render(<CalendarMonthView onDayClick={fn}/>); fireEvent.click(screen.getByText("15")); expect(fn).toHaveBeenCalledTimes(1); expect(fn.mock.calls[0][0].getDate()).toBe(15); });
  it("shows manager selector", async () => { render(<CalendarMonthView onDayClick={jest.fn()}/>); await waitFor(()=>expect(screen.getByLabelText("選擇成員")).toBeInTheDocument()); });
  it("shows legend", () => { render(<CalendarMonthView onDayClick={jest.fn()}/>); expect(screen.getByText("0h")).toBeInTheDocument(); expect(screen.getByText("≤8h")).toBeInTheDocument(); });
  it("shows monthly total", () => { render(<CalendarMonthView onDayClick={jest.fn()}/>); expect(screen.getByText("月計：")).toBeInTheDocument(); });
});
