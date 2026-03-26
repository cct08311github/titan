/**
 * @jest-environment node
 */
/**
 * TDD: Time entry templates — Fixes #833 (T-3)
 *
 * Tests:
 *   - POST creates template with items (max 10 limit)
 *   - GET returns templates with items
 *   - PATCH edits template name
 *   - DELETE removes template
 *   - POST apply creates entries, skips existing
 *   - User isolation (can't access others' templates)
 */

import { createMockRequest } from "../utils/test-utils";

const mockTimeEntryTemplate = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
};
const mockTimeEntry = {
  findMany: jest.fn(),
  create: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({
  prisma: {
    timeEntryTemplate: mockTimeEntryTemplate,
    timeEntry: mockTimeEntry,
  },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));
jest.mock("@/lib/request-logger", () => ({ requestLogger: (_req: unknown, fn: () => unknown) => fn() }));
jest.mock("@/lib/csrf", () => ({ validateCsrf: jest.fn(), CsrfError: class extends Error {} }));
jest.mock("@/lib/rate-limiter", () => ({
  createApiRateLimiter: jest.fn(() => ({})),
  checkRateLimit: jest.fn(),
  RateLimitError: class extends Error { retryAfter = 60; },
}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));

const SESSION = { user: { id: "u1", name: "Test", email: "t@e.com", role: "ENGINEER" }, expires: "2099" };
const OTHER_SESSION = { user: { id: "u2", name: "Other", email: "o@e.com", role: "ENGINEER" }, expires: "2099" };

describe("POST /api/time-entries/templates — create", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION);
    const { auth } = require("@/auth");
    auth.mockResolvedValue(SESSION);
  });

  it("creates template with items and enforces max 10", async () => {
    mockTimeEntryTemplate.count.mockResolvedValue(0);
    mockTimeEntryTemplate.create.mockResolvedValue({
      id: "tpl1",
      name: "My Template",
      userId: "u1",
      entries: "[]",
      items: [{ id: "i1", hours: 8, category: "PLANNED_TASK", sortOrder: 0 }],
    });

    const { POST } = await import("@/app/api/time-entries/templates/route");
    const res = await POST(createMockRequest("/api/time-entries/templates", {
      method: "POST",
      body: { name: "My Template", entries: [{ hours: 8, category: "PLANNED_TASK" }] },
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe("My Template");
  });

  it("rejects when user has 10 templates", async () => {
    mockTimeEntryTemplate.count.mockResolvedValue(10);

    const { POST } = await import("@/app/api/time-entries/templates/route");
    const res = await POST(createMockRequest("/api/time-entries/templates", {
      method: "POST",
      body: { name: "Overflow", entries: [{ hours: 4 }] },
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("10");
  });
});

describe("GET /api/time-entries/templates — list", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION);
    const { auth } = require("@/auth");
    auth.mockResolvedValue(SESSION);
  });

  it("returns templates with items for current user only", async () => {
    mockTimeEntryTemplate.findMany.mockResolvedValue([
      { id: "tpl1", name: "T1", userId: "u1", items: [{ id: "i1", hours: 8 }] },
    ]);

    const { GET } = await import("@/app/api/time-entries/templates/route");
    const res = await GET(createMockRequest("/api/time-entries/templates"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].items).toHaveLength(1);

    // Verify userId filter
    expect(mockTimeEntryTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } })
    );
  });
});

describe("PATCH /api/time-entries/templates/[id] — rename", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION);
    const { auth } = require("@/auth");
    auth.mockResolvedValue(SESSION);
  });

  it("renames own template", async () => {
    mockTimeEntryTemplate.findUnique.mockResolvedValue({ id: "tpl1", userId: "u1", name: "Old" });
    mockTimeEntryTemplate.update.mockResolvedValue({
      id: "tpl1", userId: "u1", name: "New Name", items: [],
    });

    const { PATCH } = await import("@/app/api/time-entries/templates/[id]/route");
    const context = { params: Promise.resolve({ id: "tpl1" }) };
    const res = await PATCH(
      createMockRequest("/api/time-entries/templates/tpl1", { method: "PATCH", body: { name: "New Name" } }),
      context,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.name).toBe("New Name");
  });

  it("rejects renaming another user's template", async () => {
    mockTimeEntryTemplate.findUnique.mockResolvedValue({ id: "tpl2", userId: "u2", name: "Other" });

    const { PATCH } = await import("@/app/api/time-entries/templates/[id]/route");
    const context = { params: Promise.resolve({ id: "tpl2" }) };
    const res = await PATCH(
      createMockRequest("/api/time-entries/templates/tpl2", { method: "PATCH", body: { name: "Hijack" } }),
      context,
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent template", async () => {
    mockTimeEntryTemplate.findUnique.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/time-entries/templates/[id]/route");
    const context = { params: Promise.resolve({ id: "nope" }) };
    const res = await PATCH(
      createMockRequest("/api/time-entries/templates/nope", { method: "PATCH", body: { name: "X" } }),
      context,
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/time-entries/templates/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION);
    const { auth } = require("@/auth");
    auth.mockResolvedValue(SESSION);
  });

  it("deletes own template", async () => {
    mockTimeEntryTemplate.findUnique.mockResolvedValue({ id: "tpl1", userId: "u1" });
    mockTimeEntryTemplate.delete.mockResolvedValue({});

    const { DELETE } = await import("@/app/api/time-entries/templates/[id]/route");
    const context = { params: Promise.resolve({ id: "tpl1" }) };
    const res = await DELETE(
      createMockRequest("/api/time-entries/templates/tpl1", { method: "DELETE" }),
      context,
    );
    expect(res.status).toBe(200);
  });

  it("rejects deleting another user's template", async () => {
    mockTimeEntryTemplate.findUnique.mockResolvedValue({ id: "tpl2", userId: "u2" });

    const { DELETE } = await import("@/app/api/time-entries/templates/[id]/route");
    const context = { params: Promise.resolve({ id: "tpl2" }) };
    const res = await DELETE(
      createMockRequest("/api/time-entries/templates/tpl2", { method: "DELETE" }),
      context,
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/time-entries/templates/[id]/apply", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION);
    const { auth } = require("@/auth");
    auth.mockResolvedValue(SESSION);
  });

  it("applies template, skipping existing tasks on date", async () => {
    mockTimeEntryTemplate.findUnique.mockResolvedValue({
      id: "tpl1",
      userId: "u1",
      entries: JSON.stringify([
        { hours: 8, category: "PLANNED_TASK", taskId: "t1" },
        { hours: 2, category: "ADMIN", taskId: "t2" },
      ]),
    });
    // t1 already exists on that date
    mockTimeEntry.findMany.mockResolvedValue([{ taskId: "t1" }]);
    mockTimeEntry.create.mockResolvedValue({ id: "new1", taskId: "t2", hours: 2 });

    const { POST } = await import("@/app/api/time-entries/templates/[id]/apply/route");
    const context = { params: Promise.resolve({ id: "tpl1" }) };
    const res = await POST(
      createMockRequest("/api/time-entries/templates/tpl1/apply", { method: "POST", body: { date: "2026-03-26" } }),
      context,
    );
    expect(res.status).toBe(201);
    // Only t2 should have been created (t1 was skipped)
    expect(mockTimeEntry.create).toHaveBeenCalledTimes(1);
  });

  it("rejects applying another user's template", async () => {
    mockTimeEntryTemplate.findUnique.mockResolvedValue({ id: "tpl2", userId: "u2", entries: "[]" });

    const { POST } = await import("@/app/api/time-entries/templates/[id]/apply/route");
    const context = { params: Promise.resolve({ id: "tpl2" }) };
    const res = await POST(
      createMockRequest("/api/time-entries/templates/tpl2/apply", { method: "POST", body: { date: "2026-03-26" } }),
      context,
    );
    expect(res.status).toBe(403);
  });
});
