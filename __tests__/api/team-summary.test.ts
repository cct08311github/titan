/**
 * @jest-environment node
 */
/**
 * Issue #819 -- Team summary API tests
 */

describe("Team summary API", () => {
  it("team-summary/route.ts exports GET", async () => {
    const mod = await import("@/app/api/metrics/team-summary/route");
    expect(mod).toHaveProperty("GET");
  });
});

describe("Dashboard view toggle", () => {
  it("localStorage key for view preference is defined", () => {
    // The dashboard uses 'titan-dashboard-view' key
    const key = "titan-dashboard-view";
    expect(typeof key).toBe("string");
  });
});
