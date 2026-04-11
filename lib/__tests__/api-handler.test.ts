/**
 * @jest-environment node
 */
/**
 * TDD: Tests written FIRST (RED) before implementation.
 * Issue #80: Unified error handling middleware
 */

import { NextRequest } from "next/server";
import {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "@/services/errors";

// ── Mock next/server ──────────────────────────────────────────────────────
// T1452: success() now uses `new NextResponse(body, {status, headers})`.
// Mock NextResponse as a constructor that also exposes the .json() static method.
jest.mock("next/server", () => {
  const actual = jest.requireActual("next/server");

  function MockNextResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    const status = init?.status ?? 200;
    // Parse body if it is a JSON string (as success() passes JSON.stringify output)
    let parsed: unknown = body;
    if (typeof body === "string") {
      try { parsed = JSON.parse(body); } catch { /* leave as-is */ }
    }
    return {
      status,
      _body: parsed,
      json: async () => parsed,
      headers: { set: jest.fn(), get: jest.fn() },
    };
  }
  MockNextResponse.json = jest.fn((body: unknown, init?: { status?: number }) => ({
    status: init?.status ?? 200,
    _body: body,
    json: async () => body,
  }));

  return {
    ...actual,
    NextResponse: MockNextResponse,
  };
});

// ── Import after mocks ────────────────────────────────────────────────────
import { apiHandler } from "@/lib/api-handler";
import { success, error as errorResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";

// ── Helpers ───────────────────────────────────────────────────────────────
function makeFakeRequest(url = "http://localhost/api/test"): NextRequest {
  return {
    url,
    method: "GET",
    headers: new Headers(),
    json: jest.fn(),
  } as unknown as NextRequest;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("apiHandler", () => {
  const req = makeFakeRequest();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 200 with data on success", async () => {
    const handler = apiHandler(async (_req: NextRequest) => success({ id: 1 }));
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({ id: 1 });
  });

  test("returns 400 with details on ValidationError", async () => {
    const handler = apiHandler(async (_req: NextRequest) => {
      throw new ValidationError("invalid input");
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("ValidationError");
    expect(body.message).toBe("invalid input");
  });

  test("returns 401 on UnauthorizedError", async () => {
    const handler = apiHandler(async (_req: NextRequest) => {
      throw new UnauthorizedError();
    });
    const res = await handler(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UnauthorizedError");
  });

  test("returns 403 on ForbiddenError", async () => {
    const handler = apiHandler(async (_req: NextRequest) => {
      throw new ForbiddenError();
    });
    const res = await handler(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("ForbiddenError");
  });

  test("returns 404 on NotFoundError", async () => {
    const handler = apiHandler(async (_req: NextRequest) => {
      throw new NotFoundError("resource not found");
    });
    const res = await handler(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("NotFoundError");
    expect(body.message).toBe("resource not found");
  });

  test("returns 500 on unexpected error", async () => {
    const handler = apiHandler(async (_req: NextRequest) => {
      throw new Error("something broke");
    });
    const res = await handler(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("InternalServerError");
  });

  test("response format is { ok, data, error, message }", async () => {
    const handler = apiHandler(async (_req: NextRequest) => success({ value: 42 }));
    const res = await handler(req);
    const body = await res.json();
    expect(body).toHaveProperty("ok");
    expect(body).toHaveProperty("data");
    // error and message are optional — present only on error responses
    expect(Object.keys(body)).toContain("ok");
    expect(Object.keys(body)).toContain("data");
  });

  test("logs error details for 500 errors", async () => {
    // apiHandler now uses pino logger.error instead of console.error
    const loggerSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
    const handler = apiHandler(async (_req: NextRequest) => {
      throw new Error("db crash");
    });
    await handler(req);
    expect(loggerSpy).toHaveBeenCalled();
    const callArgs = loggerSpy.mock.calls[0];
    // First arg is the bindings object with err field
    const bindings = callArgs[0] as Record<string, unknown>;
    expect(bindings.err).toBeInstanceOf(Error);
    expect((bindings.err as Error).message).toBe("db crash");
    loggerSpy.mockRestore();
  });

  test("does not expose stack trace in response", async () => {
    const handler = apiHandler(async (_req: NextRequest) => {
      throw new Error("internal");
    });
    const res = await handler(req);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/at\s+\w+\s+\(.*\.ts/);
    expect(body).not.toHaveProperty("stack");
  });

  test("handles async handler correctly", async () => {
    const handler = apiHandler(async (_req: NextRequest) => {
      await Promise.resolve();
      return success({ async: true });
    });
    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ async: true });
  });
});

// ── api-response helper tests ─────────────────────────────────────────────
describe("success()", () => {
  test("wraps data in { ok: true, data } with status 200", async () => {
    const res = success({ name: "test" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({ name: "test" });
  });

  test("accepts custom status code", async () => {
    const res = success({}, 201);
    expect(res.status).toBe(201);
  });
});

describe("errorResponse()", () => {
  test("returns { ok: false, error, message } with given status", async () => {
    const res = errorResponse("ValidationError", "bad input", 400);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("ValidationError");
    expect(body.message).toBe("bad input");
  });
});
