/**
 * @jest-environment node
 */
describe("Team summary API", () => {
  it("team-summary/route.ts exports GET", async () => {
    const mod = await import("@/app/api/metrics/team-summary/route");
    expect(mod).toHaveProperty("GET");
  });
});
