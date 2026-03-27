/**
 * @jest-environment node
 */
/**
 * API route tests: /api/documents/{id}/approve and /api/documents/{id}/reject — Issue #1002
 */
import { createMockRequest } from "../utils/test-utils";

const mockDocument = {
  findUnique: jest.fn(),
  update: jest.fn(),
};

const mockAuditLog = {
  create: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({
  prisma: { document: mockDocument, auditLog: mockAuditLog },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

const MANAGER_SESSION = {
  user: { id: "m1", name: "Manager", email: "m@e.com", role: "MANAGER" },
  expires: "2099",
};

const ENGINEER_SESSION = {
  user: { id: "e1", name: "Engineer", email: "e@e.com", role: "ENGINEER" },
  expires: "2099",
};

const MOCK_DOC_IN_REVIEW = {
  id: "doc-1",
  title: "SOP-001",
  content: "# SOP",
  status: "IN_REVIEW",
  version: 1,
  createdBy: "e1",
  updatedBy: "e1",
};

describe("POST /api/documents/{id}/approve", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
  });

  it("approves an IN_REVIEW document → PUBLISHED", async () => {
    mockDocument.findUnique.mockResolvedValue(MOCK_DOC_IN_REVIEW);
    mockDocument.update.mockResolvedValue({
      ...MOCK_DOC_IN_REVIEW,
      status: "PUBLISHED",
      updatedBy: "m1",
      creator: { id: "e1", name: "Engineer" },
      updater: { id: "m1", name: "Manager" },
    });
    mockAuditLog.create.mockResolvedValue({});

    const { POST } = await import("@/app/api/documents/[id]/approve/route");
    const res = await (POST as Function)(
      createMockRequest("/api/documents/doc-1/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("PUBLISHED");

    // Verify AuditLog was written
    expect(mockAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "m1",
          action: "APPROVE",
          module: "KNOWLEDGE",
          resourceType: "Document",
          resourceId: "doc-1",
        }),
      })
    );
  });

  it("returns 404 for nonexistent document", async () => {
    mockDocument.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/documents/[id]/approve/route");
    const res = await (POST as Function)(
      createMockRequest("/api/documents/missing/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "missing" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for non-IN_REVIEW document", async () => {
    mockDocument.findUnique.mockResolvedValue({
      ...MOCK_DOC_IN_REVIEW,
      status: "DRAFT",
    });

    const { POST } = await import("@/app/api/documents/[id]/approve/route");
    const res = await (POST as Function)(
      createMockRequest("/api/documents/doc-1/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 for ENGINEER role", async () => {
    mockGetServerSession.mockResolvedValue(ENGINEER_SESSION);

    const { POST } = await import("@/app/api/documents/[id]/approve/route");
    const res = await (POST as Function)(
      createMockRequest("/api/documents/doc-1/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/documents/{id}/reject", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
  });

  it("rejects an IN_REVIEW document → DRAFT with reason", async () => {
    mockDocument.findUnique.mockResolvedValue(MOCK_DOC_IN_REVIEW);
    mockDocument.update.mockResolvedValue({
      ...MOCK_DOC_IN_REVIEW,
      status: "DRAFT",
      updatedBy: "m1",
      creator: { id: "e1", name: "Engineer" },
      updater: { id: "m1", name: "Manager" },
    });
    mockAuditLog.create.mockResolvedValue({});

    const { POST } = await import("@/app/api/documents/[id]/reject/route");
    const res = await (POST as Function)(
      createMockRequest("/api/documents/doc-1/reject", {
        method: "POST",
        body: { reason: "內容不完整，需要補充第三章" },
      }),
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("DRAFT");

    // Verify AuditLog was written with reason in metadata
    expect(mockAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "m1",
          action: "REJECT",
          module: "KNOWLEDGE",
          resourceType: "Document",
          resourceId: "doc-1",
          metadata: { reason: "內容不完整，需要補充第三章" },
        }),
      })
    );
  });

  it("returns 400 when no reason provided", async () => {
    mockDocument.findUnique.mockResolvedValue(MOCK_DOC_IN_REVIEW);

    const { POST } = await import("@/app/api/documents/[id]/reject/route");
    const res = await (POST as Function)(
      createMockRequest("/api/documents/doc-1/reject", {
        method: "POST",
        body: {},
      }),
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for nonexistent document", async () => {
    mockDocument.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/documents/[id]/reject/route");
    const res = await (POST as Function)(
      createMockRequest("/api/documents/missing/reject", {
        method: "POST",
        body: { reason: "test" },
      }),
      { params: Promise.resolve({ id: "missing" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for non-IN_REVIEW document", async () => {
    mockDocument.findUnique.mockResolvedValue({
      ...MOCK_DOC_IN_REVIEW,
      status: "PUBLISHED",
    });

    const { POST } = await import("@/app/api/documents/[id]/reject/route");
    const res = await (POST as Function)(
      createMockRequest("/api/documents/doc-1/reject", {
        method: "POST",
        body: { reason: "test" },
      }),
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 for ENGINEER role", async () => {
    mockGetServerSession.mockResolvedValue(ENGINEER_SESSION);

    const { POST } = await import("@/app/api/documents/[id]/reject/route");
    const res = await (POST as Function)(
      createMockRequest("/api/documents/doc-1/reject", {
        method: "POST",
        body: { reason: "test" },
      }),
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    expect(res.status).toBe(403);
  });
});
