/**
 * @jest-environment node
 */
/**
 * API route tests: /api/cron/daily-digest — Issue #1004
 */
import { createMockRequest } from "../utils/test-utils";

const mockTimeEntry = {
  findMany: jest.fn(),
};

const mockNotification = {
  createMany: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({
  prisma: { timeEntry: mockTimeEntry, notification: mockNotification },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

// Mock @/auth for apiHandler audit logging (Auth.js v5)
jest.mock("@/auth", () => ({ auth: jest.fn().mockResolvedValue(null) }));

// Helper: create a mock request with the CRON_SECRET header
function createCronRequest(url: string) {
  return {
    url: `http://localhost${url}`,
    method: "POST",
    json: jest.fn(() => Promise.resolve({})),
    headers: {
      get: (name: string) =>
        name === "x-cron-secret" ? "test-cron-secret" : null,
    },
    nextUrl: new URL(`http://localhost${url}`),
  } as unknown as import("next/server").NextRequest;
}

describe("POST /api/cron/daily-digest", () => {
  beforeAll(() => {
    process.env.CRON_SECRET = "test-cron-secret";
  });
  afterAll(() => {
    delete process.env.CRON_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // No session needed for cron endpoint
    mockGetServerSession.mockResolvedValue(null);
  });

  it("creates notifications for users with pending entries", async () => {
    mockTimeEntry.findMany.mockResolvedValue([
      { userId: "u1", hours: 2, task: { title: "Task A" } },
      { userId: "u1", hours: 1.5, task: { title: "Task B" } },
      { userId: "u2", hours: 3, task: { title: "Task C" } },
    ]);
    mockNotification.createMany.mockResolvedValue({ count: 2 });

    const { POST } = await import("@/app/api/cron/daily-digest/route");
    const res = await (POST as Function)(
      createCronRequest("/api/cron/daily-digest")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.created).toBe(2);
    expect(body.data.usersNotified).toBe(2);

    // Verify notification content
    expect(mockNotification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          userId: "u1",
          type: "TIMESHEET_REMINDER",
          title: "每日工時摘要",
        }),
        expect.objectContaining({
          userId: "u2",
          type: "TIMESHEET_REMINDER",
        }),
      ]),
    });
  });

  it("returns 0 created when no pending entries", async () => {
    mockTimeEntry.findMany.mockResolvedValue([]);
    mockNotification.createMany.mockResolvedValue({ count: 0 });

    const { POST } = await import("@/app/api/cron/daily-digest/route");
    const res = await (POST as Function)(
      createCronRequest("/api/cron/daily-digest")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.created).toBe(0);
    expect(body.data.usersNotified).toBe(0);
  });
});
