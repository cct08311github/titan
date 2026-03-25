/**
 * @jest-environment node
 */
/**
 * TDD tests for POST /api/time-entries/settle-month (TS-25)
 *
 * Requirements:
 *   - POST locks all entries for a given month (sets locked=true)
 *   - Only MANAGER can settle
 *   - Already settled month returns 409
 *
 * Tests written BEFORE implementation (Red phase).
 */
import { createMockRequest } from "../utils/test-utils";

// ── Prisma mock ──────────────────────────────────────────────────────────────
const mockTimeEntry = {
  findMany: jest.fn(),
  updateMany: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({
  prisma: {
    timeEntry: mockTimeEntry,
  },
}));

// ── Auth mock ────────────────────────────────────────────────────────────────
const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

const SESSION_MANAGER = {
  user: { id: "mgr-1", name: "Manager", email: "mgr@t.com", role: "MANAGER" },
  expires: "2099",
};
const SESSION_ENGINEER = {
  user: { id: "eng-1", name: "Engineer", email: "e@t.com", role: "ENGINEER" },
  expires: "2099",
};

// Suppress console.error from apiHandler
jest.spyOn(console, "error").mockImplementation(() => {});

describe("POST /api/time-entries/settle-month (TS-25)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("locks all entries for the given month when called by MANAGER", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);
    // Unsettled entries exist
    mockTimeEntry.findMany.mockResolvedValue([
      { id: "e1", locked: false },
      { id: "e2", locked: false },
    ]);
    mockTimeEntry.updateMany.mockResolvedValue({ count: 2 });

    const { POST } = await import("@/app/api/time-entries/settle-month/route");
    const res = await POST(
      createMockRequest("/api/time-entries/settle-month", {
        method: "POST",
        body: { year: 2026, month: 3 },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.lockedCount).toBe(2);
    expect(mockTimeEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { locked: true },
      })
    );
  });

  it("returns 403 when ENGINEER tries to settle", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ENGINEER);

    const { POST } = await import("@/app/api/time-entries/settle-month/route");
    const res = await POST(
      createMockRequest("/api/time-entries/settle-month", {
        method: "POST",
        body: { year: 2026, month: 3 },
      })
    );

    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { POST } = await import("@/app/api/time-entries/settle-month/route");
    const res = await POST(
      createMockRequest("/api/time-entries/settle-month", {
        method: "POST",
        body: { year: 2026, month: 3 },
      })
    );

    expect(res.status).toBe(401);
  });

  it("returns 409 when month is already fully settled", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);
    // All entries are already locked
    mockTimeEntry.findMany.mockResolvedValue([
      { id: "e1", locked: true },
      { id: "e2", locked: true },
    ]);

    const { POST } = await import("@/app/api/time-entries/settle-month/route");
    const res = await POST(
      createMockRequest("/api/time-entries/settle-month", {
        method: "POST",
        body: { year: 2026, month: 3 },
      })
    );

    expect(res.status).toBe(409);
  });

  it("returns 400 for invalid year/month", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);

    const { POST } = await import("@/app/api/time-entries/settle-month/route");
    const res = await POST(
      createMockRequest("/api/time-entries/settle-month", {
        method: "POST",
        body: { year: 2026, month: 13 },
      })
    );

    expect(res.status).toBe(400);
  });
});
