/**
 * @jest-environment node
 */
/**
 * Tests for External Monitoring Integration — Issue #863
 * Covers: Webhook API, alert CRUD, KPI history, dashboard summary
 */

import { createMockRequest } from "../utils/test-utils";

// ── Mocks ───────────────────────────────────────────────────────────

const mockMonitoringAlert = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

const mockTask = {
  create: jest.fn(),
};

const mockKPI = {
  findUnique: jest.fn(),
  update: jest.fn(),
};

const mockKPIHistory = {
  findMany: jest.fn(),
  findFirst: jest.fn(),
  upsert: jest.fn(),
};

const mockTransaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    monitoringAlert: mockMonitoringAlert,
    task: mockTask,
    kPI: mockKPI,
    kPIHistory: mockKPIHistory,
    auditLog: { create: jest.fn() },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
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

const MOCK_ALERT = {
  id: "alert-1",
  alertName: "HighCPU",
  severity: "critical",
  status: "FIRING",
  source: "grafana",
  summary: "CPU usage > 90%",
  description: "Server cpu-01 is above threshold",
  labels: { instance: "cpu-01" },
  startsAt: new Date("2026-03-26T10:00:00Z"),
  endsAt: null,
  acknowledgedBy: null,
  acknowledgedAt: null,
  relatedTaskId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Webhook API Tests ───────────────────────────────────────────────

describe("POST /api/integrations/monitoring/webhook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    // Webhook uses API key auth, but apiHandler still calls auth() for audit logging
    const { auth } = require("@/auth");
    auth.mockResolvedValue(null);
    mockMonitoringAlert.findFirst.mockResolvedValue(null);
    mockMonitoringAlert.create.mockResolvedValue(MOCK_ALERT);
    // Clear env
    delete process.env.MONITORING_WEBHOOK_KEY;
  });

  it("returns 503 when MONITORING_WEBHOOK_KEY is not configured", async () => {
    const { POST } = await import("@/app/api/integrations/monitoring/webhook/route");
    const res = await POST(
      createMockRequest("/api/integrations/monitoring/webhook", {
        method: "POST",
        body: {
          alertName: "HighCPU",
          severity: "critical",
          status: "firing",
          annotations: { summary: "CPU usage > 90%" },
          startsAt: "2026-03-26T10:00:00Z",
          source: "grafana",
        },
      })
    );
    expect(res.status).toBe(503);
  });

  it("creates alert from valid Grafana webhook payload (201)", async () => {
    process.env.MONITORING_WEBHOOK_KEY = "secret-key-123";
    const { POST } = await import("@/app/api/integrations/monitoring/webhook/route");
    const mockReq = createMockRequest("/api/integrations/monitoring/webhook", {
      method: "POST",
      body: {
        alertName: "HighCPU",
        severity: "critical",
        status: "firing",
        annotations: { summary: "CPU usage > 90%" },
        startsAt: "2026-03-26T10:00:00Z",
        source: "grafana",
      },
    });
    mockReq.headers.set("authorization", "Bearer secret-key-123");
    const res = await POST(mockReq);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 401 when API key is required but missing", async () => {
    process.env.MONITORING_WEBHOOK_KEY = "secret-key-123";
    const { POST } = await import("@/app/api/integrations/monitoring/webhook/route");
    const res = await POST(
      createMockRequest("/api/integrations/monitoring/webhook", {
        method: "POST",
        body: {
          alertName: "HighCPU",
          severity: "critical",
          status: "firing",
          startsAt: "2026-03-26T10:00:00Z",
        },
      })
    );
    expect(res.status).toBe(401);
  });

  it("updates existing alert when same alertName+startsAt (upsert)", async () => {
    process.env.MONITORING_WEBHOOK_KEY = "secret-key-123";
    mockMonitoringAlert.findFirst.mockResolvedValue(MOCK_ALERT);
    mockMonitoringAlert.update.mockResolvedValue({ ...MOCK_ALERT, status: "RESOLVED" });

    const { POST } = await import("@/app/api/integrations/monitoring/webhook/route");
    const mockReq = createMockRequest("/api/integrations/monitoring/webhook", {
      method: "POST",
      body: {
        alertName: "HighCPU",
        severity: "critical",
        status: "resolved",
        startsAt: "2026-03-26T10:00:00Z",
        endsAt: "2026-03-26T11:00:00Z",
      },
    });
    mockReq.headers.set("authorization", "Bearer secret-key-123");
    const res = await POST(mockReq);
    expect(res.status).toBe(201);
    expect(mockMonitoringAlert.update).toHaveBeenCalled();
  });

  it("rejects invalid payload (400)", async () => {
    process.env.MONITORING_WEBHOOK_KEY = "secret-key-123";
    const { POST } = await import("@/app/api/integrations/monitoring/webhook/route");
    const mockReq = createMockRequest("/api/integrations/monitoring/webhook", {
      method: "POST",
      body: { alertName: "test" }, // missing required fields
    });
    mockReq.headers.set("authorization", "Bearer secret-key-123");
    const res = await POST(mockReq);
    expect(res.status).toBe(400);
  });
});

// ── Alert CRUD Tests ────────────────────────────────────────────────

describe("GET /api/monitoring-alerts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION);
    const { auth } = require("@/auth");
    auth.mockResolvedValue(SESSION);
    mockMonitoringAlert.findMany.mockResolvedValue([MOCK_ALERT]);
  });

  it("returns list of alerts", async () => {
    const { GET } = await import("@/app/api/monitoring-alerts/route");
    const res = await GET(createMockRequest("/api/monitoring-alerts"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
  });

  it("filters by status param", async () => {
    const { GET } = await import("@/app/api/monitoring-alerts/route");
    await GET(createMockRequest("/api/monitoring-alerts", {
      searchParams: { status: "FIRING" },
    }));
    expect(mockMonitoringAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "FIRING" }),
      })
    );
  });
});

describe("PATCH /api/monitoring-alerts/{id}", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION);
    const { auth } = require("@/auth");
    auth.mockResolvedValue(SESSION);
  });

  it("acknowledges an alert", async () => {
    mockMonitoringAlert.update.mockResolvedValue({
      ...MOCK_ALERT,
      status: "ACKNOWLEDGED",
      acknowledgedBy: "user-1",
    });
    const { PATCH } = await import("@/app/api/monitoring-alerts/[id]/route");
    const res = await PATCH(
      createMockRequest("/api/monitoring-alerts/alert-1", {
        method: "PATCH",
        body: { action: "acknowledge" },
      }),
      { params: Promise.resolve({ id: "alert-1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("creates task from alert", async () => {
    mockMonitoringAlert.findUnique.mockResolvedValue(MOCK_ALERT);
    const createdTask = { id: "task-1", title: "[告警] HighCPU: CPU usage > 90%" };
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        task: { create: jest.fn().mockResolvedValue(createdTask) },
        monitoringAlert: { update: jest.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    const { PATCH } = await import("@/app/api/monitoring-alerts/[id]/route");
    const res = await PATCH(
      createMockRequest("/api/monitoring-alerts/alert-1", {
        method: "PATCH",
        body: { action: "create_task" },
      }),
      { params: Promise.resolve({ id: "alert-1" }) }
    );
    expect(res.status).toBe(201);
  });

  it("returns 400 for invalid action", async () => {
    const { PATCH } = await import("@/app/api/monitoring-alerts/[id]/route");
    const res = await PATCH(
      createMockRequest("/api/monitoring-alerts/alert-1", {
        method: "PATCH",
        body: { action: "invalid" },
      }),
      { params: Promise.resolve({ id: "alert-1" }) }
    );
    expect(res.status).toBe(400);
  });
});

// ── KPI History Tests ───────────────────────────────────────────────

describe("GET /api/kpi/{id}/history", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION);
    const { auth } = require("@/auth");
    auth.mockResolvedValue(SESSION);
    mockKPI.findUnique.mockResolvedValue({ id: "kpi-1", title: "系統可用率" });
    mockKPIHistory.findMany.mockResolvedValue([
      { id: "h1", kpiId: "kpi-1", period: "2026-03", actual: 99.95, source: "Grafana" },
    ]);
  });

  it("returns KPI history time series", async () => {
    const { GET } = await import("@/app/api/kpi/[id]/history/route");
    const res = await GET(
      createMockRequest("/api/kpi/kpi-1/history"),
      { params: Promise.resolve({ id: "kpi-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].period).toBe("2026-03");
  });

  it("returns 404 for non-existent KPI", async () => {
    mockKPI.findUnique.mockResolvedValue(null);
    const { GET } = await import("@/app/api/kpi/[id]/history/route");
    const res = await GET(
      createMockRequest("/api/kpi/nonexistent/history"),
      { params: Promise.resolve({ id: "nonexistent" }) }
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/kpi/{id}/history", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION);
    const { auth } = require("@/auth");
    auth.mockResolvedValue(SESSION);
    mockKPI.findUnique.mockResolvedValue({ id: "kpi-1", title: "系統可用率" });
    mockKPIHistory.upsert.mockResolvedValue({
      id: "h1",
      kpiId: "kpi-1",
      period: "2026-03",
      actual: 99.95,
    });
    mockKPIHistory.findFirst.mockResolvedValue({
      actual: 99.95,
    });
    mockKPI.update.mockResolvedValue({});
  });

  it("creates KPI history entry (201)", async () => {
    const { POST } = await import("@/app/api/kpi/[id]/history/route");
    const res = await POST(
      createMockRequest("/api/kpi/kpi-1/history", {
        method: "POST",
        body: {
          actual: 99.95,
          period: "2026-03",
          source: "Grafana uptime report",
        },
      }),
      { params: Promise.resolve({ id: "kpi-1" }) }
    );
    expect(res.status).toBe(201);
  });

  it("rejects invalid period format", async () => {
    const { POST } = await import("@/app/api/kpi/[id]/history/route");
    const res = await POST(
      createMockRequest("/api/kpi/kpi-1/history", {
        method: "POST",
        body: {
          actual: 99.95,
          period: "March 2026", // invalid format
        },
      }),
      { params: Promise.resolve({ id: "kpi-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent KPI", async () => {
    mockKPI.findUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/kpi/[id]/history/route");
    const res = await POST(
      createMockRequest("/api/kpi/nonexistent/history", {
        method: "POST",
        body: { actual: 99.95, period: "2026-03" },
      }),
      { params: Promise.resolve({ id: "nonexistent" }) }
    );
    expect(res.status).toBe(404);
  });
});
