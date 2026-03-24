/**
 * @jest-environment node
 */
/**
 * TDD: Tests written FIRST (RED) before implementation.
 * Issue #124: RBAC complete coverage — documents DELETE, deliverables all, notifications generate
 *
 * Each uncovered route must:
 *   - return 401 without auth
 *   - return 403 for wrong role (where withManager is required)
 */

import { NextRequest } from "next/server";

// ── Mock next-auth ──────────────────────────────────────────────────────────
const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

// ── Mock next/server ────────────────────────────────────────────────────────
jest.mock("next/server", () => {
  const actual = jest.requireActual("next/server");
  return {
    ...actual,
    NextResponse: {
      json: jest.fn((body: unknown, init?: { status?: number }) => ({
        status: init?.status ?? 200,
        _body: body,
        json: async () => body,
      })),
    },
  };
});

// ── Mock prisma ──────────────────────────────────────────────────────────────
jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    documentVersion: {
      create: jest.fn(),
    },
    deliverable: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// ── Mock DeliverableService ─────────────────────────────────────────────────
jest.mock("@/services/deliverable-service", () => ({
  DeliverableService: jest.fn().mockImplementation(() => ({
    listDeliverables: jest.fn().mockResolvedValue([]),
    createDeliverable: jest.fn().mockResolvedValue({ id: "d1" }),
    getDeliverable: jest.fn().mockResolvedValue({ id: "d1" }),
  })),
}));

// ── Mock NotificationService ────────────────────────────────────────────────
jest.mock("@/services/notification-service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    generateAll: jest.fn().mockResolvedValue({ created: 0 }),
  })),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeManagerSession(id = "manager-1") {
  return {
    user: { id, name: "Manager", email: "mgr@example.com", role: "MANAGER" },
    expires: "2099-01-01",
  };
}

function makeEngineerSession(id = "engineer-1") {
  return {
    user: { id, name: "Engineer", email: "eng@example.com", role: "ENGINEER" },
    expires: "2099-01-01",
  };
}

function makeRequest(url = "http://localhost/api/test", method = "GET"): NextRequest {
  return {
    url,
    method,
    headers: new Headers(),
    json: jest.fn().mockResolvedValue({}),
  } as unknown as NextRequest;
}

function makeContext(id = "test-id") {
  return { params: Promise.resolve({ id }) };
}

// ── documents DELETE /api/documents/[id] ────────────────────────────────────

describe("documents DELETE /api/documents/[id]", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let DELETE: any;

  beforeAll(async () => {
    ({ DELETE } = await import("@/app/api/documents/[id]/route"));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const req = makeRequest("http://localhost/api/documents/1", "DELETE");
    const res = await DELETE(req, makeContext("doc-1"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UnauthorizedError");
  });

  test("returns 403 for ENGINEER (requires MANAGER role)", async () => {
    mockGetServerSession.mockResolvedValue(makeEngineerSession());
    const req = makeRequest("http://localhost/api/documents/1", "DELETE");
    const res = await DELETE(req, makeContext("doc-1"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("ForbiddenError");
  });

  test("returns 200 for MANAGER", async () => {
    const { prisma } = await import("@/lib/prisma");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.document.delete as any).mockResolvedValue({});
    mockGetServerSession.mockResolvedValue(makeManagerSession());
    const req = makeRequest("http://localhost/api/documents/1", "DELETE");
    const res = await DELETE(req, makeContext("doc-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

// ── deliverables GET /api/deliverables ──────────────────────────────────────

describe("deliverables GET /api/deliverables", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let GET: any;

  beforeAll(async () => {
    ({ GET } = await import("@/app/api/deliverables/route"));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const req = makeRequest("http://localhost/api/deliverables?taskId=t1");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UnauthorizedError");
  });

  test("returns 200 for authenticated user", async () => {
    mockGetServerSession.mockResolvedValue(makeEngineerSession());
    const req = makeRequest("http://localhost/api/deliverables");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});

// ── deliverables POST /api/deliverables ─────────────────────────────────────

describe("deliverables POST /api/deliverables", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let POST: any;

  beforeAll(async () => {
    ({ POST } = await import("@/app/api/deliverables/route"));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const req = makeRequest("http://localhost/api/deliverables", "POST");
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UnauthorizedError");
  });

  test("returns 403 for ENGINEER (requires MANAGER role)", async () => {
    mockGetServerSession.mockResolvedValue(makeEngineerSession());
    const req = makeRequest("http://localhost/api/deliverables", "POST");
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("ForbiddenError");
  });

  test("returns 201 for MANAGER with valid body", async () => {
    mockGetServerSession.mockResolvedValue(makeManagerSession());
    const req = makeRequest("http://localhost/api/deliverables", "POST");
    (req.json as jest.Mock).mockResolvedValue({
      title: "Test deliverable",
      type: "DOCUMENT",
      taskId: "task-1",
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});

// ── deliverables GET /api/deliverables/[id] ──────────────────────────────────

describe("deliverables GET /api/deliverables/[id]", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let GET: any;

  beforeAll(async () => {
    ({ GET } = await import("@/app/api/deliverables/[id]/route"));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const req = makeRequest("http://localhost/api/deliverables/d1");
    const res = await GET(req, makeContext("d1"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UnauthorizedError");
  });

  test("returns 200 for authenticated user", async () => {
    mockGetServerSession.mockResolvedValue(makeEngineerSession());
    const req = makeRequest("http://localhost/api/deliverables/d1");
    const res = await GET(req, makeContext("d1"));
    expect(res.status).toBe(200);
  });
});

// ── deliverables PATCH /api/deliverables/[id] ────────────────────────────────

describe("deliverables PATCH /api/deliverables/[id]", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let PATCH: any;

  beforeAll(async () => {
    ({ PATCH } = await import("@/app/api/deliverables/[id]/route"));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const req = makeRequest("http://localhost/api/deliverables/d1", "PATCH");
    const res = await PATCH(req, makeContext("d1"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UnauthorizedError");
  });

  test("returns 403 for ENGINEER (requires MANAGER role)", async () => {
    mockGetServerSession.mockResolvedValue(makeEngineerSession());
    const req = makeRequest("http://localhost/api/deliverables/d1", "PATCH");
    (req.json as jest.Mock).mockResolvedValue({ status: "APPROVED" });
    const res = await PATCH(req, makeContext("d1"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("ForbiddenError");
  });
});

// ── deliverables DELETE /api/deliverables/[id] ───────────────────────────────

describe("deliverables DELETE /api/deliverables/[id]", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let DELETE: any;

  beforeAll(async () => {
    ({ DELETE } = await import("@/app/api/deliverables/[id]/route"));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const req = makeRequest("http://localhost/api/deliverables/d1", "DELETE");
    const res = await DELETE(req, makeContext("d1"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UnauthorizedError");
  });

  test("returns 403 for ENGINEER (requires MANAGER role)", async () => {
    mockGetServerSession.mockResolvedValue(makeEngineerSession());
    const req = makeRequest("http://localhost/api/deliverables/d1", "DELETE");
    const res = await DELETE(req, makeContext("d1"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("ForbiddenError");
  });
});

// ── notifications POST /api/notifications/generate ──────────────────────────

describe("notifications POST /api/notifications/generate", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let POST: any;

  beforeAll(async () => {
    ({ POST } = await import("@/app/api/notifications/generate/route"));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 401 without auth", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const req = makeRequest("http://localhost/api/notifications/generate", "POST");
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UnauthorizedError");
  });

  test("returns 403 for ENGINEER (requires MANAGER role)", async () => {
    mockGetServerSession.mockResolvedValue(makeEngineerSession());
    const req = makeRequest("http://localhost/api/notifications/generate", "POST");
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("ForbiddenError");
  });

  test("returns 200 for MANAGER", async () => {
    mockGetServerSession.mockResolvedValue(makeManagerSession());
    const req = makeRequest("http://localhost/api/notifications/generate", "POST");
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
