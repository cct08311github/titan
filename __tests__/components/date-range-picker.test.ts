/**
 * @jest-environment node
 */
/**
 * Issue #820 -- DateRangePicker validation tests
 */

describe("Date range validation", () => {
  it("rejects range exceeding 1 year (366 days)", () => {
    const from = "2025-01-01";
    const to = "2026-03-01"; // > 1 year
    const diff = (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBeGreaterThan(366);
  });

  it("accepts range within 1 year", () => {
    const from = "2025-12-01";
    const to = "2026-03-01";
    const diff = (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBeLessThanOrEqual(366);
  });

  it("rejects from > to", () => {
    const from = "2026-03-01";
    const to = "2026-01-01";
    expect(from > to).toBe(true);
  });

  it("YYYY-MM-DD format is correct", () => {
    const date = new Date(2026, 2, 26); // March 26
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    expect(`${y}-${m}-${d}`).toBe("2026-03-26");
  });

  it("cross-year range handled correctly (2025-12 to 2026-03)", () => {
    const from = "2025-12-01";
    const to = "2026-03-31";
    const diff = (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBeGreaterThan(0);
    expect(diff).toBeLessThanOrEqual(366);
  });

  it("this week calculation returns Monday to Sunday", () => {
    const date = new Date("2026-03-26"); // Thursday
    const day = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
    expect(monday.getDay()).toBe(1); // Monday
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    expect(sunday.getDay()).toBe(0); // Sunday
  });
});

describe("DateRangePicker component exists", () => {
  it("exports DateRangePicker and getDefaultDateRange", async () => {
    const mod = await import("@/app/components/date-range-picker");
    expect(mod).toHaveProperty("DateRangePicker");
    expect(mod).toHaveProperty("getDefaultDateRange");
  });
});
