/**
 * @jest-environment node
 */
/**
 * Tests for Email Notification Channel — Issue #864
 * Covers: trigger API, email preferences, idempotency, templates
 */

import { createMockRequest } from "../utils/test-utils";

// ── Mocks ───────────────────────────────────────────────────────────

const mockTask = { findMany: jest.fn() };
const mockUser = { findMany: jest.fn() };
const mockTimeEntry = { findMany: jest.fn() };
const mockNotificationPreference = { findMany: jest.fn() };
const mockNotificationLog = { findFirst: jest.fn(), create: jest.fn() };

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: mockTask,
    user: mockUser,
    timeEntry: mockTimeEntry,
    notificationPreference: mockNotificationPreference,
    notificationLog: mockNotificationLog,
    auditLog: { create: jest.fn() },
  },
}));

const mockSendEmail = jest.fn();
jest.mock("@/lib/email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));
jest.mock("@/lib/request-logger", () => ({ requestLogger: (_req: unknown, fn: () => unknown) => fn() }));
jest.mock("@/lib/csrf", () => ({ validateCsrf: jest.fn(), CsrfError: class extends Error {} }));
jest.mock("@/lib/rate-limiter", () => ({
  createApiRateLimiter: jest.fn(() => ({})),
  checkRateLimit: jest.fn(),
  RateLimitError: class extends Error { retryAfter = 60; },
}));
jest.mock("@/services/audit-service", () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    log: jest.fn().mockResolvedValue(undefined),
  })),
}));

const SESSION = {
  user: { id: "user-1", name: "Test", email: "t@e.com", role: "ADMIN" },
  expires: "2099",
};

// ── Tests ───────────────────────────────────────────────────────────

describe("POST /api/notifications/trigger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    const { auth } = require("@/auth");
    auth.mockResolvedValue(SESSION);
    mockNotificationPreference.findMany.mockResolvedValue([]);
    mockNotificationLog.findFirst.mockResolvedValue(null);
    mockNotificationLog.create.mockResolvedValue({});
    mockSendEmail.mockResolvedValue({ success: true, messageId: "msg-1" });
  });

  it("sends due-soon email for tasks due within 24h", async () => {
    const tomorrow = new Date();
    tomorrow.setHours(tomorrow.getHours() + 12);

    mockTask.findMany
      .mockResolvedValueOnce([{
        id: "task-1",
        title: "Deploy patch",
        dueDate: tomorrow,
        primaryAssigneeId: "user-1",
        primaryAssignee: { email: "test@bank.com" },
      }])
      .mockResolvedValueOnce([]); // overdue tasks empty

    const { POST } = await import("@/app/api/notifications/trigger/route");
    const res = await POST(createMockRequest("/api/notifications/trigger", { method: "POST" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.sent).toBeGreaterThanOrEqual(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@bank.com",
        subject: expect.stringContaining("即將到期"),
      })
    );
  });

  it("respects emailEnabled=false preference (skips email)", async () => {
    const tomorrow = new Date();
    tomorrow.setHours(tomorrow.getHours() + 12);

    mockNotificationPreference.findMany.mockResolvedValue([{
      userId: "user-1",
      type: "TASK_DUE_SOON",
      emailEnabled: false,
    }]);

    mockTask.findMany
      .mockResolvedValueOnce([{
        id: "task-1",
        title: "Deploy patch",
        dueDate: tomorrow,
        primaryAssigneeId: "user-1",
        primaryAssignee: { email: "test@bank.com" },
      }])
      .mockResolvedValueOnce([]);

    const { POST } = await import("@/app/api/notifications/trigger/route");
    const res = await POST(createMockRequest("/api/notifications/trigger", { method: "POST" }));
    const body = await res.json();
    expect(body.data.skipped).toBeGreaterThanOrEqual(1);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("is idempotent — same hour repeated call does not resend", async () => {
    const tomorrow = new Date();
    tomorrow.setHours(tomorrow.getHours() + 12);

    mockTask.findMany
      .mockResolvedValueOnce([{
        id: "task-1",
        title: "Deploy patch",
        dueDate: tomorrow,
        primaryAssigneeId: "user-1",
        primaryAssignee: { email: "test@bank.com" },
      }])
      .mockResolvedValueOnce([]);

    // Simulate already sent
    mockNotificationLog.findFirst.mockResolvedValue({ id: "log-1", status: "sent" });

    const { POST } = await import("@/app/api/notifications/trigger/route");
    const res = await POST(createMockRequest("/api/notifications/trigger", { method: "POST" }));
    const body = await res.json();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(body.data.skipped).toBeGreaterThanOrEqual(1);
  });

  it("logs failed email sends without blocking", async () => {
    const tomorrow = new Date();
    tomorrow.setHours(tomorrow.getHours() + 12);

    mockTask.findMany
      .mockResolvedValueOnce([{
        id: "task-1",
        title: "Deploy patch",
        dueDate: tomorrow,
        primaryAssigneeId: "user-1",
        primaryAssignee: { email: "test@bank.com" },
      }])
      .mockResolvedValueOnce([]);

    mockSendEmail.mockResolvedValue({ success: false, error: "SMTP timeout" });

    const { POST } = await import("@/app/api/notifications/trigger/route");
    const res = await POST(createMockRequest("/api/notifications/trigger", { method: "POST" }));
    expect(res.status).toBe(200); // should not 500
    const body = await res.json();
    expect(body.data.failed).toBe(1);
    expect(mockNotificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "failed",
          errorMessage: "SMTP timeout",
        }),
      })
    );
  });

  it("sends overdue email with overdue days count", async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);

    mockTask.findMany
      .mockResolvedValueOnce([]) // due-soon empty
      .mockResolvedValueOnce([{
        id: "task-2",
        title: "Review report",
        dueDate: pastDate,
        primaryAssigneeId: "user-1",
        primaryAssignee: { email: "test@bank.com" },
      }]);

    const { POST } = await import("@/app/api/notifications/trigger/route");
    const res = await POST(createMockRequest("/api/notifications/trigger", { method: "POST" }));
    const body = await res.json();
    expect(body.data.sent).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("已逾期"),
      })
    );
  });

  it("does not send to users without email", async () => {
    const tomorrow = new Date();
    tomorrow.setHours(tomorrow.getHours() + 12);

    mockTask.findMany
      .mockResolvedValueOnce([{
        id: "task-1",
        title: "Deploy",
        dueDate: tomorrow,
        primaryAssigneeId: "user-1",
        primaryAssignee: { email: null },
      }])
      .mockResolvedValueOnce([]);

    const { POST } = await import("@/app/api/notifications/trigger/route");
    await POST(createMockRequest("/api/notifications/trigger", { method: "POST" }));
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe("Email templates", () => {
  it("dueSoonEmail includes task title and link", async () => {
    const { dueSoonEmail } = await import("@/lib/email-templates");
    const email = dueSoonEmail("Deploy patch", "task-123", "2026/03/28");
    expect(email.subject).toContain("Deploy patch");
    expect(email.html).toContain("task-123");
    expect(email.html).toContain("2026/03/28");
  });

  it("overdueEmail includes overdue days", async () => {
    const { overdueEmail } = await import("@/lib/email-templates");
    const email = overdueEmail("Review report", "task-456", 3);
    expect(email.subject).toContain("3 天");
    expect(email.html).toContain("3 天");
  });

  it("slaAlertEmail uses warning emoji in subject", async () => {
    const { slaAlertEmail } = await import("@/lib/email-templates");
    const email = slaAlertEmail("DB Migration", "task-789", "1h 30m");
    expect(email.subject).toContain("⚠️");
    expect(email.html).toContain("1h 30m");
  });

  it("timesheetReminderEmail shows hours", async () => {
    const { timesheetReminderEmail } = await import("@/lib/email-templates");
    const email = timesheetReminderEmail(28, 40);
    expect(email.subject).toContain("28/40");
    expect(email.html).toContain("28");
  });
});
