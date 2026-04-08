/**
 * @jest-environment node
 */
/**
 * API tests for POST /api/feedback (Task 26 — Issue #787)
 */
import { POST } from "@/app/api/feedback/route";
import { NextRequest } from "next/server";

// Mock auth
jest.mock("@/auth", () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: "u1", name: "Test User" } }),
}));

const mockLoggerInfo = jest.fn();
jest.mock("@/lib/logger", () => ({
  logger: { info: (...args: unknown[]) => mockLoggerInfo(...args), error: jest.fn(), warn: jest.fn() },
}));

function makeReq(body: unknown) {
  return new NextRequest("http://localhost:3100/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/feedback", () => {
  afterEach(() => mockLoggerInfo.mockClear());

  it("returns 400 when message is empty", async () => {
    const res = await POST(makeReq({ message: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when message is missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 200 and logs feedback on valid input", async () => {
    const res = await POST(makeReq({ message: "This is great!" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockLoggerInfo).toHaveBeenCalledTimes(1);
    const logged = mockLoggerInfo.mock.calls[0][0];
    expect(logged.type).toBe("user_feedback");
    expect(logged.message).toBe("This is great!");
    expect(logged.userName).toBe("Test User");
  });
});
