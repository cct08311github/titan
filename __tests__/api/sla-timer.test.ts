/**
 * @jest-environment node
 */
/**
 * TDD tests for Issue #860: SLA Timer
 */
import { createMockRequest } from "../utils/test-utils";

const mockTask = { findMany: jest.fn() };
const mockNotification = {
  findFirst: jest.fn(),
  create: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: mockTask,
    notification: mockNotification,
    auditLog: { create: jest.fn() },
  },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

const SESSION = {
  user: { id: "u1", name: "Test", email: "t@e.com", role: "MANAGER" },
  expires: "2099",
};

// ─── SLA check API ─────────────────────────────────────────────────────

describe("GET /api/tasks/sla-check", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("creates SLA_EXPIRING notification for tasks within 2h window", async () => {
    const slaDeadline = new Date(Date.now() + 60 * 60 * 1000); // 1h from now
    mockTask.findMany.mockResolvedValue([
      { id: "t1", title: "緊急事件", slaDeadline, primaryAssigneeId: "u2" },
    ]);
    mockNotification.findFirst.mockResolvedValue(null); // no recent notif
    mockNotification.create.mockResolvedValue({});

    const { GET } = await import("@/app/api/tasks/sla-check/route");
    const res = await GET(
      createMockRequest("/api/tasks/sla-check"),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.checked).toBe(1);
    expect(body.data.notificationsCreated).toBe(1);
    expect(mockNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "u2",
          type: "SLA_EXPIRING",
          relatedId: "t1",
        }),
      })
    );
  });

  it("skips notification if already sent recently", async () => {
    const slaDeadline = new Date(Date.now() + 60 * 60 * 1000);
    mockTask.findMany.mockResolvedValue([
      { id: "t1", title: "已通知的事件", slaDeadline, primaryAssigneeId: "u2" },
    ]);
    mockNotification.findFirst.mockResolvedValue({ id: "notif-1" }); // recent notif exists

    const { GET } = await import("@/app/api/tasks/sla-check/route");
    const res = await GET(
      createMockRequest("/api/tasks/sla-check"),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.notificationsCreated).toBe(0);
    expect(mockNotification.create).not.toHaveBeenCalled();
  });

  it("returns empty when no tasks with SLA in window", async () => {
    mockTask.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/tasks/sla-check/route");
    const res = await GET(
      createMockRequest("/api/tasks/sla-check"),
      { params: Promise.resolve({}) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.checked).toBe(0);
    expect(body.data.notificationsCreated).toBe(0);
  });
});

// ─── SLA utilities ─────────────────────────────────────────────────────

describe("SLA utilities", () => {
  const {
    slaRemainingMs,
    formatSlaCountdown,
    getSlaStatus,
  } = require("@/lib/sla-utils");

  it("slaRemainingMs returns positive for future deadline", () => {
    const future = new Date(Date.now() + 3600000);
    const result = slaRemainingMs(future);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(3600000);
  });

  it("slaRemainingMs returns negative for past deadline", () => {
    const past = new Date(Date.now() - 3600000);
    const result = slaRemainingMs(past);
    expect(result).toBeLessThan(0);
  });

  it("formatSlaCountdown formats as HH:MM:SS", () => {
    // 1 hour, 30 minutes, 45 seconds
    const ms = (1 * 3600 + 30 * 60 + 45) * 1000;
    expect(formatSlaCountdown(ms)).toBe("01:30:45");
  });

  it("formatSlaCountdown includes days for > 24h", () => {
    const ms = (26 * 3600 + 15 * 60) * 1000; // 26h 15min
    expect(formatSlaCountdown(ms)).toContain("1 天");
    expect(formatSlaCountdown(ms)).toContain("02:15:00");
  });

  it("formatSlaCountdown shows overdue for expired", () => {
    const ms = -30 * 60 * 1000; // 30 minutes over
    const result = formatSlaCountdown(ms);
    expect(result).toContain("已逾期");
    expect(result).toContain("30");
  });

  it("getSlaStatus returns safe when > 50%", () => {
    expect(getSlaStatus(7200000, 10000000)).toBe("safe");
  });

  it("getSlaStatus returns warning when 25-50%", () => {
    expect(getSlaStatus(3000000, 10000000)).toBe("warning");
  });

  it("getSlaStatus returns danger when < 25%", () => {
    expect(getSlaStatus(1000000, 10000000)).toBe("danger");
  });

  it("getSlaStatus returns expired when <= 0", () => {
    expect(getSlaStatus(-1000)).toBe("expired");
  });

  it("getSlaStatus uses absolute thresholds when no totalMs", () => {
    // > 2h = safe
    expect(getSlaStatus(3 * 3600000)).toBe("safe");
    // < 30min = danger
    expect(getSlaStatus(10 * 60000)).toBe("danger");
  });
});

// ─── Validators ────────────────────────────────────────────────────────

describe("Task validator with slaDeadline", () => {
  it("updateTaskSchema accepts slaDeadline", () => {
    const { updateTaskSchema } = require("@/validators/shared/task");
    const result = updateTaskSchema.safeParse({
      slaDeadline: "2026-03-26T11:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("updateTaskSchema accepts null slaDeadline", () => {
    const { updateTaskSchema } = require("@/validators/shared/task");
    const result = updateTaskSchema.safeParse({
      slaDeadline: null,
    });
    expect(result.success).toBe(true);
  });

  it("updateTaskSchema rejects invalid slaDeadline", () => {
    const { updateTaskSchema } = require("@/validators/shared/task");
    const result = updateTaskSchema.safeParse({
      slaDeadline: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});
