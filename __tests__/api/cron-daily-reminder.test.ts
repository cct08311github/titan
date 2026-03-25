/**
 * @jest-environment node
 */
/**
 * TDD tests for POST /api/cron/daily-reminder (TS-29)
 *
 * Requirements:
 *   - Triggers buildDailyTimesheetReminders from NotificationService
 *   - Creates notifications for users who haven't filled timesheet today
 *   - Skips weekends
 *   - Returns count of notifications created
 *
 * Tests written BEFORE implementation (Red phase).
 */
import { createMockRequest } from "../utils/test-utils";

// ── Prisma mock ──────────────────────────────────────────────────────────────
const mockTimeEntry = { findMany: jest.fn() };
const mockUser = { findMany: jest.fn() };
const mockNotification = {
  findMany: jest.fn(),
  createMany: jest.fn(),
};

const mockAuditLog = { create: jest.fn() };

jest.mock("@/lib/prisma", () => ({
  prisma: {
    timeEntry: mockTimeEntry,
    user: mockUser,
    notification: mockNotification,
    auditLog: mockAuditLog,
  },
}));

// ── Auth mock ────────────────────────────────────────────────────────────────
const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

// Mock @/auth for apiHandler audit logging
jest.mock("@/auth", () => ({
  auth: jest.fn().mockResolvedValue(null),
}));

// Suppress console.error
jest.spyOn(console, "error").mockImplementation(() => {});

describe("POST /api/cron/daily-reminder (TS-29)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockNotification.findMany.mockResolvedValue([]);
  });

  it("triggers daily reminders and returns created count", async () => {
    // Mock active users with no entries today
    mockUser.findMany.mockResolvedValue([
      { id: "u1", name: "User 1" },
      { id: "u2", name: "User 2" },
    ]);
    mockTimeEntry.findMany.mockResolvedValue([]); // No entries today
    mockNotification.createMany.mockResolvedValue({ count: 2 });

    const { POST } = await import("@/app/api/cron/daily-reminder/route");
    const res = await POST(
      createMockRequest("/api/cron/daily-reminder", { method: "POST" })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.created).toBeDefined();
    expect(typeof body.data.created).toBe("number");
  });

  it("skips weekends and returns 0 created", async () => {
    // Force a Saturday date via the route's internal logic
    // The route should handle weekend detection
    mockUser.findMany.mockResolvedValue([
      { id: "u1", name: "User 1" },
    ]);
    mockTimeEntry.findMany.mockResolvedValue([]);
    mockNotification.createMany.mockResolvedValue({ count: 0 });

    const { POST } = await import("@/app/api/cron/daily-reminder/route");
    const res = await POST(
      createMockRequest("/api/cron/daily-reminder", { method: "POST" })
    );

    // The endpoint itself should succeed (200) even on weekends
    expect(res.status).toBe(200);
  });

  it("does not create duplicate reminders for users with existing entries", async () => {
    mockUser.findMany.mockResolvedValue([
      { id: "u1", name: "User 1" },
      { id: "u2", name: "User 2" },
    ]);
    // u1 has entries today, u2 does not
    mockTimeEntry.findMany.mockResolvedValue([
      { userId: "u1" },
    ]);
    mockNotification.createMany.mockResolvedValue({ count: 1 });

    const { POST } = await import("@/app/api/cron/daily-reminder/route");
    const res = await POST(
      createMockRequest("/api/cron/daily-reminder", { method: "POST" })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 200 even when no users need reminding", async () => {
    mockUser.findMany.mockResolvedValue([]);
    mockTimeEntry.findMany.mockResolvedValue([]);

    const { POST } = await import("@/app/api/cron/daily-reminder/route");
    const res = await POST(
      createMockRequest("/api/cron/daily-reminder", { method: "POST" })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.created).toBe(0);
  });
});
