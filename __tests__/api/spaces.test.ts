/**
 * @jest-environment node
 */
/**
 * API route tests: /api/spaces — Issue #967
 */
import { createMockRequest } from "../utils/test-utils";

const mockSpace = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn().mockResolvedValue(0),
};

jest.mock("@/lib/prisma", () => ({ prisma: { knowledgeSpace: mockSpace } }));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));

const SESSION = { user: { id: "u1", name: "Test", email: "t@e.com", role: "ADMIN" }, expires: "2099" };

const MOCK_SPACE = {
  id: "space-1",
  name: "IT Operations",
  description: "IT 部門知識庫",
  createdBy: "u1",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  creator: { id: "u1", name: "Test" },
  _count: { documents: 3 },
};

describe("GET /api/spaces", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockSpace.findMany.mockResolvedValue([MOCK_SPACE]);
  });

  it("returns space list when authenticated", async () => {
    const { GET } = await import("@/app/api/spaces/route");
    const res = await (GET as Function)(createMockRequest("/api/spaces"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].name).toBe("IT Operations");
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/spaces/route");
    const res = await (GET as Function)(createMockRequest("/api/spaces"));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/spaces", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockSpace.create.mockResolvedValue(MOCK_SPACE);
  });

  it("creates a space with valid input", async () => {
    const { POST } = await import("@/app/api/spaces/route");
    const res = await (POST as Function)(
      createMockRequest("/api/spaces", {
        method: "POST",
        body: { name: "IT Operations", description: "IT 部門知識庫" },
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe("IT Operations");
  });

  it("returns 400 with empty name", async () => {
    const { POST } = await import("@/app/api/spaces/route");
    const res = await (POST as Function)(
      createMockRequest("/api/spaces", {
        method: "POST",
        body: { name: "" },
      })
    );
    expect(res.status).toBe(400);
  });
});
