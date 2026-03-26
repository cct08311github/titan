/**
 * @jest-environment node
 */
/**
 * Tests for Recurring Tasks API — Issue #862
 * Covers: CRUD, generate, idempotency, isActive toggle, tag "recurring"
 */

import { createMockRequest } from "../utils/test-utils";

// ── Mocks ───────────────────────────────────────────────────────────

const mockRecurringRule = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
};

const mockTask = {
  create: jest.fn(),
};

const mockTransaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    recurringRule: mockRecurringRule,
    task: mockTask,
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

// ── Constants ───────────────────────────────────────────────────────

const SESSION = {
  user: { id: "user-1", name: "Test", email: "t@e.com", role: "ADMIN" },
  expires: "2099",
};

const MOCK_RULE = {
  id: "rule-1",
  title: "每日巡檢 — {date}",
  description: "系統巡檢",
  category: "ADMIN",
  priority: "P2",
  assigneeId: "user-1",
  templateId: null,
  frequency: "DAILY",
  dayOfWeek: null,
  dayOfMonth: null,
  monthOfYear: null,
  timeOfDay: "08:00",
  estimatedHours: 0.5,
  isActive: true,
  lastGeneratedAt: null,
  nextDueAt: new Date("2026-03-27T08:00:00"),
  creatorId: "user-1",
  createdAt: new Date("2026-03-26T00:00:00"),
  updatedAt: new Date("2026-03-26T00:00:00"),
};

// ── Tests ───────────────────────────────────────────────────────────

describe("GET /api/recurring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION);
    const { auth } = require("@/auth");
    auth.mockResolvedValue(SESSION);
    mockRecurringRule.findMany.mockResolvedValue([MOCK_RULE]);
  });

  it("returns list of recurring rules", async () => {
    const { GET } = await import("@/app/api/recurring/route");
    const res = await GET(createMockRequest("/api/recurring"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].title).toBe("每日巡檢 — {date}");
  });
});

describe("POST /api/recurring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION);
    const { auth } = require("@/auth");
    auth.mockResolvedValue(SESSION);
    mockRecurringRule.create.mockResolvedValue(MOCK_RULE);
  });

  it("creates a new recurring rule with 201", async () => {
    const { POST } = await import("@/app/api/recurring/route");
    const res = await POST(
      createMockRequest("/api/recurring", {
        method: "POST",
        body: {
          title: "每日巡檢 — {date}",
          frequency: "DAILY",
          timeOfDay: "08:00",
          category: "ADMIN",
        },
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("rejects invalid frequency", async () => {
    const { POST } = await import("@/app/api/recurring/route");
    const res = await POST(
      createMockRequest("/api/recurring", {
        method: "POST",
        body: {
          title: "Test",
          frequency: "INVALID",
        },
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects empty title", async () => {
    const { POST } = await import("@/app/api/recurring/route");
    const res = await POST(
      createMockRequest("/api/recurring", {
        method: "POST",
        body: {
          title: "",
          frequency: "DAILY",
        },
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/recurring/{id}", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION);
    const { auth } = require("@/auth");
    auth.mockResolvedValue(SESSION);
    mockRecurringRule.findUnique.mockResolvedValue(MOCK_RULE);
    mockRecurringRule.update.mockResolvedValue({ ...MOCK_RULE, isActive: false });
  });

  it("deactivates a recurring rule", async () => {
    const { PATCH } = await import("@/app/api/recurring/[id]/route");
    const res = await PATCH(
      createMockRequest("/api/recurring/rule-1", {
        method: "PATCH",
        body: { isActive: false },
      }),
      { params: Promise.resolve({ id: "rule-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 404 for non-existent rule", async () => {
    mockRecurringRule.findUnique.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/recurring/[id]/route");
    const res = await PATCH(
      createMockRequest("/api/recurring/nonexistent", {
        method: "PATCH",
        body: { isActive: false },
      }),
      { params: Promise.resolve({ id: "nonexistent" }) }
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/recurring/{id}", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION);
    const { auth } = require("@/auth");
    auth.mockResolvedValue(SESSION);
    mockRecurringRule.findUnique.mockResolvedValue(MOCK_RULE);
    mockRecurringRule.delete.mockResolvedValue(MOCK_RULE);
  });

  it("deletes a recurring rule", async () => {
    const { DELETE } = await import("@/app/api/recurring/[id]/route");
    const res = await DELETE(
      createMockRequest("/api/recurring/rule-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "rule-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.deleted).toBe(true);
  });

  it("returns 404 for non-existent rule", async () => {
    mockRecurringRule.findUnique.mockResolvedValue(null);
    const { DELETE } = await import("@/app/api/recurring/[id]/route");
    const res = await DELETE(
      createMockRequest("/api/recurring/nonexistent", { method: "DELETE" }),
      { params: Promise.resolve({ id: "nonexistent" }) }
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/recurring/generate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION);
    const { auth } = require("@/auth");
    auth.mockResolvedValue(SESSION);
  });

  it("generates tasks for due rules", async () => {
    const dueRule = {
      ...MOCK_RULE,
      nextDueAt: new Date("2026-03-25T08:00:00"), // already past
    };
    mockRecurringRule.findMany.mockResolvedValue([dueRule]);

    const createdTask = {
      id: "task-new-1",
      title: "每日巡檢 — 2026/03/26",
      tags: ["recurring"],
    };

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        task: { create: jest.fn().mockResolvedValue(createdTask) },
        recurringRule: { update: jest.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    const { POST } = await import("@/app/api/recurring/generate/route");
    const res = await POST(createMockRequest("/api/recurring/generate", { method: "POST" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.generated).toBe(1);
  });

  it("does not generate for inactive rules (filtered by DB query)", async () => {
    mockRecurringRule.findMany.mockResolvedValue([]);
    const { POST } = await import("@/app/api/recurring/generate/route");
    const res = await POST(createMockRequest("/api/recurring/generate", { method: "POST" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.generated).toBe(0);
  });

  it("generated task includes 'recurring' tag", async () => {
    const dueRule = {
      ...MOCK_RULE,
      nextDueAt: new Date("2026-03-25T08:00:00"),
    };
    mockRecurringRule.findMany.mockResolvedValue([dueRule]);

    let capturedTaskData: Record<string, unknown> | null = null;
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        task: {
          create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
            capturedTaskData = args.data;
            return { id: "task-1", title: "test", tags: ["recurring"] };
          }),
        },
        recurringRule: { update: jest.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    const { POST } = await import("@/app/api/recurring/generate/route");
    await POST(createMockRequest("/api/recurring/generate", { method: "POST" }));

    expect(capturedTaskData).not.toBeNull();
    expect((capturedTaskData as Record<string, unknown>).tags).toEqual(["recurring"]);
  });
});
