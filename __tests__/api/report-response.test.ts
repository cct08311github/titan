/**
 * @jest-environment node
 */
/**
 * Tests for report-response unified format — Issue #1004
 */
import { reportSuccess } from "@/lib/report-response";

describe("reportSuccess", () => {
  it("wraps data with meta including dateRange and reportType", async () => {
    const data = { items: [1, 2, 3] };
    const res = reportSuccess(data, "velocity", {
      from: "2026-01-01",
      to: "2026-03-31",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({ items: [1, 2, 3] });
    expect(body.meta).toBeDefined();
    expect(body.meta.reportType).toBe("velocity");
    expect(body.meta.dateRange.from).toBe("2026-01-01");
    expect(body.meta.dateRange.to).toBe("2026-03-31");
    expect(body.meta.generatedAt).toBeDefined();
  });

  it("accepts custom status code", async () => {
    const res = reportSuccess({}, "test", { from: "2026-01-01", to: "2026-01-31" }, 201);
    expect(res.status).toBe(201);
  });
});
