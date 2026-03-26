/**
 * @jest-environment node
 */
/**
 * API route tests: /api/documents/{id}/verify — Issue #968
 */
import { createMockRequest } from "../utils/test-utils";

const mockDocument = {
  findUnique: jest.fn(),
  findMany: jest.fn(),
  update: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({ prisma: { document: mockDocument } }));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));

const SESSION = { user: { id: "u1", name: "Verifier", email: "v@e.com", role: "MANAGER" }, expires: "2099" };

const MOCK_DOC = {
  id: "doc-1",
  title: "SOP-001",
  content: "# SOP",
  version: 1,
  verifierId: null,
  verifiedAt: null,
  verifyIntervalDays: null,
};

describe("POST /api/documents/{id}/verify", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("marks document as verified", async () => {
    mockDocument.findUnique.mockResolvedValue(MOCK_DOC);
    mockDocument.update.mockResolvedValue({
      ...MOCK_DOC,
      verifierId: "u1",
      verifiedAt: new Date(),
      verifyIntervalDays: 90,
      creator: { id: "u1", name: "Verifier" },
      updater: { id: "u1", name: "Verifier" },
      verifier: { id: "u1", name: "Verifier" },
    });

    const { POST } = await import("@/app/api/documents/[id]/verify/route");
    const res = await (POST as Function)(
      createMockRequest("/api/documents/doc-1/verify", {
        method: "POST",
        body: { verifyIntervalDays: 90 },
      }),
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.verifierId).toBe("u1");
    expect(body.data.verifier.name).toBe("Verifier");
  });

  it("returns 404 for nonexistent document", async () => {
    mockDocument.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/documents/[id]/verify/route");
    const res = await (POST as Function)(
      createMockRequest("/api/documents/missing/verify", { method: "POST" }),
      { params: Promise.resolve({ id: "missing" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 without session", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { POST } = await import("@/app/api/documents/[id]/verify/route");
    const res = await (POST as Function)(
      createMockRequest("/api/documents/doc-1/verify", { method: "POST" }),
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    expect(res.status).toBe(401);
  });
});

describe("GET /api/documents/verification-due", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("returns verification summary", async () => {
    const expiredDoc = {
      id: "doc-1",
      title: "Expired SOP",
      slug: "expired-sop",
      verifierId: "u1",
      verifiedAt: new Date("2025-01-01"),
      verifyIntervalDays: 90,
      updatedAt: new Date(),
      verifier: { id: "u1", name: "Verifier" },
      creator: { id: "u1", name: "Creator" },
    };
    mockDocument.findMany.mockResolvedValue([expiredDoc]);

    const { GET } = await import("@/app/api/documents/verification-due/route");
    const res = await (GET as Function)(
      createMockRequest("/api/documents/verification-due")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.summary.total).toBe(1);
    expect(body.data.summary.expired).toBe(1);
    expect(body.data.items[0].status).toBe("expired");
  });
});
