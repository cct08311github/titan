/**
 * @jest-environment node
 */
/**
 * API route tests: /api/documents/{id}/publish and /api/documents/{id}/archive — Issue #967
 */
import { createMockRequest } from "../utils/test-utils";

const mockDocument = {
  findUnique: jest.fn(),
  update: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({ prisma: { document: mockDocument } }));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));

const SESSION = { user: { id: "u1", name: "Test", email: "t@e.com", role: "MANAGER" }, expires: "2099" };

const MOCK_DOC_DRAFT = {
  id: "doc-1",
  title: "Test",
  content: "# Test",
  status: "DRAFT",
  version: 1,
  createdBy: "u1",
  updatedBy: "u1",
  creator: { id: "u1", name: "Test" },
  updater: { id: "u1", name: "Test" },
};

describe("POST /api/documents/{id}/publish", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("publishes a draft document", async () => {
    mockDocument.findUnique.mockResolvedValue(MOCK_DOC_DRAFT);
    mockDocument.update.mockResolvedValue({ ...MOCK_DOC_DRAFT, status: "PUBLISHED" });

    const { POST } = await import("@/app/api/documents/[id]/publish/route");
    const res = await (POST as Function)(
      createMockRequest("/api/documents/doc-1/publish", { method: "POST" }),
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("PUBLISHED");
  });

  it("returns 404 for nonexistent document", async () => {
    mockDocument.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/documents/[id]/publish/route");
    const res = await (POST as Function)(
      createMockRequest("/api/documents/missing/publish", { method: "POST" }),
      { params: Promise.resolve({ id: "missing" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for already published document", async () => {
    mockDocument.findUnique.mockResolvedValue({ ...MOCK_DOC_DRAFT, status: "PUBLISHED" });

    const { POST } = await import("@/app/api/documents/[id]/publish/route");
    const res = await (POST as Function)(
      createMockRequest("/api/documents/doc-1/publish", { method: "POST" }),
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/documents/{id}/archive", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("archives a published document", async () => {
    mockDocument.findUnique.mockResolvedValue({ ...MOCK_DOC_DRAFT, status: "PUBLISHED" });
    mockDocument.update.mockResolvedValue({ ...MOCK_DOC_DRAFT, status: "ARCHIVED" });

    const { POST } = await import("@/app/api/documents/[id]/archive/route");
    const res = await (POST as Function)(
      createMockRequest("/api/documents/doc-1/archive", { method: "POST" }),
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("ARCHIVED");
  });

  it("returns 400 for already archived document", async () => {
    mockDocument.findUnique.mockResolvedValue({ ...MOCK_DOC_DRAFT, status: "ARCHIVED" });

    const { POST } = await import("@/app/api/documents/[id]/archive/route");
    const res = await (POST as Function)(
      createMockRequest("/api/documents/doc-1/archive", { method: "POST" }),
      { params: Promise.resolve({ id: "doc-1" }) }
    );
    expect(res.status).toBe(400);
  });
});
