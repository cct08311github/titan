/**
 * @jest-environment node
 */
/**
 * API route tests: /api/time-entries and /api/time-entries/[id]
 */
import { createMockRequest } from "../utils/test-utils";

const mockTimeEntry = { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() };

jest.mock("@/lib/prisma", () => ({ prisma: { timeEntry: mockTimeEntry } }));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));

const SESSION = { user: { id: "u1", name: "Test", email: "t@e.com", role: "MEMBER" }, expires: "2099" };

const MOCK_ENTRY = {
  id: "entry-1",
  userId: "u1",
  taskId: null,
  date: new Date("2024-01-15"),
  hours: 4,
  category: "PLANNED_TASK",
  description: null,
  task: null,
};

describe("GET /api/time-entries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockTimeEntry.findMany.mockResolvedValue([MOCK_ENTRY]);
  });

  it("returns time entries when authenticated", async () => {
    const { GET } = await import("@/app/api/time-entries/route");
    const res = await GET(createMockRequest("/api/time-entries"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].id).toBe("entry-1");
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/time-entries/route");
    const res = await GET(createMockRequest("/api/time-entries"));
    expect(res.status).toBe(401);
  });

  it("filters by weekStart when provided", async () => {
    const { GET } = await import("@/app/api/time-entries/route");
    await GET(createMockRequest("/api/time-entries", { searchParams: { weekStart: "2024-01-15" } }));
    expect(mockTimeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ date: expect.any(Object) }) })
    );
  });

  it("returns 500 on database error", async () => {
    mockTimeEntry.findMany.mockRejectedValue(new Error("DB"));
    const { GET } = await import("@/app/api/time-entries/route");
    const res = await GET(createMockRequest("/api/time-entries"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/time-entries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockTimeEntry.create.mockResolvedValue(MOCK_ENTRY);
  });

  it("creates time entry with valid data", async () => {
    const { POST } = await import("@/app/api/time-entries/route");
    const res = await POST(createMockRequest("/api/time-entries", { method: "POST", body: { date: "2024-01-15", hours: 4 } }));
    expect(res.status).toBe(201);
  });

  it("returns 400 when date missing", async () => {
    const { POST } = await import("@/app/api/time-entries/route");
    const res = await POST(createMockRequest("/api/time-entries", { method: "POST", body: { hours: 4 } }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when hours missing", async () => {
    const { POST } = await import("@/app/api/time-entries/route");
    const res = await POST(createMockRequest("/api/time-entries", { method: "POST", body: { date: "2024-01-15" } }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when hours exceed 24", async () => {
    const { POST } = await import("@/app/api/time-entries/route");
    const res = await POST(createMockRequest("/api/time-entries", { method: "POST", body: { date: "2024-01-15", hours: 25 } }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when hours are negative", async () => {
    const { POST } = await import("@/app/api/time-entries/route");
    const res = await POST(createMockRequest("/api/time-entries", { method: "POST", body: { date: "2024-01-15", hours: -1 } }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/time-entries/route");
    const res = await POST(createMockRequest("/api/time-entries", { method: "POST", body: { date: "2024-01-15", hours: 4 } }));
    expect(res.status).toBe(401);
  });
});

describe("PUT/DELETE /api/time-entries/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockTimeEntry.findUnique.mockResolvedValue(MOCK_ENTRY);
    mockTimeEntry.update.mockResolvedValue({ ...MOCK_ENTRY, hours: 6 });
    mockTimeEntry.delete.mockResolvedValue(MOCK_ENTRY);
  });

  it("PUT updates time entry", async () => {
    const { PUT } = await import("@/app/api/time-entries/[id]/route");
    const res = await PUT(
      createMockRequest("/api/time-entries/entry-1", { method: "PUT", body: { hours: 6 } }),
      { params: Promise.resolve({ id: "entry-1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("PUT returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { PUT } = await import("@/app/api/time-entries/[id]/route");
    const res = await PUT(
      createMockRequest("/api/time-entries/entry-1", { method: "PUT", body: { hours: 6 } }),
      { params: Promise.resolve({ id: "entry-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("DELETE removes time entry", async () => {
    const { DELETE } = await import("@/app/api/time-entries/[id]/route");
    const res = await DELETE(
      createMockRequest("/api/time-entries/entry-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "entry-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.success).toBe(true);
  });

  it("DELETE returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { DELETE } = await import("@/app/api/time-entries/[id]/route");
    const res = await DELETE(
      createMockRequest("/api/time-entries/entry-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "entry-1" }) }
    );
    expect(res.status).toBe(401);
  });
});
