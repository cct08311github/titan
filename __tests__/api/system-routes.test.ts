/**
 * @jest-environment node
 */
/**
 * TDD-2: System monitoring API route tests — Closes #556
 *
 * Routes covered:
 *   GET  /api/health       — DB + Redis health check
 *   POST /api/error-report — Client-side error reporting
 *   GET  /api/metrics      — Prometheus-compatible metrics
 *
 * TDD red phase: tests written first to define expected behaviour.
 */

// ── Mock setup (must come before imports) ──────────────────────────────

const mockQueryRaw = jest.fn();
const mockAuditLogCreate = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
    auditLog: { create: (...a: unknown[]) => mockAuditLogCreate(...a) },
  },
}));

const mockRedisClient = {
  ping: jest.fn(),
};
const mockGetRedisClient = jest.fn();

jest.mock("@/lib/redis", () => ({
  getRedisClient: (...a: unknown[]) => mockGetRedisClient(...a),
}));

const mockSerializeMetrics = jest.fn();

jest.mock("@/lib/metrics", () => ({
  serializeMetrics: (...a: unknown[]) => mockSerializeMetrics(...a),
}));

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock @/auth for withAuth / requireAuth (Auth.js v5 uses auth() not getServerSession)
const mockAuthSession = { user: { id: "sys-1", name: "System", email: "sys@e.com", role: "ADMIN" }, expires: "2099" };
jest.mock("@/auth", () => ({ auth: jest.fn().mockResolvedValue(mockAuthSession) }));

// Helper: create minimal NextRequest for metrics endpoint
function createSystemRequest(url: string) {
  return {
    url: `http://localhost${url}`,
    method: "GET",
    json: jest.fn(() => Promise.resolve({})),
    headers: { get: (_: string) => null },
    nextUrl: new URL(`http://localhost${url}`),
  } as unknown as import("next/server").NextRequest;
}

// ========================================================================
// GET /api/health
// ========================================================================

describe("GET /api/health", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockGetRedisClient.mockReturnValue(mockRedisClient);
    mockRedisClient.ping.mockResolvedValue("PONG");
  });

  it("returns 200 with status ok when DB and Redis are healthy", async () => {
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.checks.database.status).toBe("ok");
    expect(body.checks.redis.status).toBe("ok");
  });

  it("includes uptime and timestamp in response", async () => {
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    const body = await res.json();
    expect(body.uptime).toBeDefined();
    expect(typeof body.uptime).toBe("number");
    expect(body.timestamp).toBeDefined();
    // timestamp should be a valid ISO string
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it("includes latency in health checks", async () => {
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    const body = await res.json();
    expect(typeof body.checks.database.latency).toBe("number");
    expect(typeof body.checks.redis.latency).toBe("number");
  });

  it("returns 503 with status degraded when DB connection fails", async () => {
    mockQueryRaw.mockRejectedValue(new Error("Connection refused"));
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.database.status).toBe("error");
    expect(body.checks.database.error).toContain("database connection failed");
  });

  it("returns 503 with status degraded when Redis connection fails", async () => {
    mockRedisClient.ping.mockRejectedValue(new Error("Redis timeout"));
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.redis.status).toBe("error");
    expect(body.checks.redis.error).toContain("redis connection failed");
  });

  it("returns 503 when Redis returns non-PONG response", async () => {
    mockRedisClient.ping.mockResolvedValue("NOT_PONG");
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.checks.redis.status).toBe("error");
  });

  it("returns 200 ok when Redis is not configured (graceful fallback)", async () => {
    mockGetRedisClient.mockReturnValue(null);
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.checks.redis.status).toBe("ok");
  });

  it("returns 503 when both DB and Redis fail", async () => {
    mockQueryRaw.mockRejectedValue(new Error("DB down"));
    mockRedisClient.ping.mockRejectedValue(new Error("Redis down"));
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.database.status).toBe("error");
    expect(body.checks.redis.status).toBe("error");
  });
});

// ========================================================================
// POST /api/error-report
// ========================================================================

describe("POST /api/error-report", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockAuditLogCreate.mockResolvedValue({ id: "audit-1" });
  });

  function makeRequest(body: unknown) {
    const url = "http://localhost/api/error-report";
    return {
      url,
      method: "POST",
      json: jest.fn(() => Promise.resolve(body)),
      headers: new Headers({ "user-agent": "TestBrowser/1.0" }),
      nextUrl: new URL(url),
    } as unknown as import("next/server").NextRequest;
  }

  it("returns 400 when message is missing", async () => {
    const { POST } = await import("@/app/api/error-report/route");
    const res = await POST(makeRequest({ digest: "abc123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    // T1452: error() returns { error: <errorName>, message: <msg> }
    expect(body.error).toBe("ValidationError");
    expect(body.message).toBe("message required");
  });

  it("returns 200 and persists error to auditLog on valid report", async () => {
    const { POST } = await import("@/app/api/error-report/route");
    const res = await POST(
      makeRequest({
        message: "TypeError: cannot read property 'x'",
        digest: "abc123",
        source: "error-boundary",
        url: "/dashboard",
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "FRONTEND_ERROR",
          resourceType: "error",
          resourceId: "abc123",
        }),
      })
    );
  });

  it("truncates message to 2000 characters in stored detail", async () => {
    const longMessage = "x".repeat(3000);
    const { POST } = await import("@/app/api/error-report/route");
    await POST(makeRequest({ message: longMessage }));
    const createCall = mockAuditLogCreate.mock.calls[0][0];
    const detail = JSON.parse(createCall.data.detail);
    expect(detail.message.length).toBe(2000);
  });

  it("handles missing optional fields gracefully", async () => {
    const { POST } = await import("@/app/api/error-report/route");
    const res = await POST(makeRequest({ message: "some error" }));
    expect(res.status).toBe(200);
    const createCall = mockAuditLogCreate.mock.calls[0][0];
    const detail = JSON.parse(createCall.data.detail);
    expect(detail.digest).toBeNull();
    expect(detail.source).toBe("unknown");
    expect(detail.url).toBeNull();
  });

  it("stores user-agent from request headers", async () => {
    const { POST } = await import("@/app/api/error-report/route");
    await POST(makeRequest({ message: "error" }));
    const createCall = mockAuditLogCreate.mock.calls[0][0];
    const detail = JSON.parse(createCall.data.detail);
    expect(detail.userAgent).toBe("TestBrowser/1.0");
  });

  it("returns 500 when auditLog.create fails", async () => {
    mockAuditLogCreate.mockRejectedValue(new Error("DB write failed"));
    const { POST } = await import("@/app/api/error-report/route");
    const res = await POST(makeRequest({ message: "some error" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    // T1452: error() returns { error: <errorName>, message: <msg> }
    expect(body.error).toBe("InternalError");
  });

  it("returns 500 when request JSON parsing fails", async () => {
    const { POST } = await import("@/app/api/error-report/route");
    const req = makeRequest({});
    (req.json as jest.Mock).mockRejectedValue(new SyntaxError("Unexpected token"));
    const res = await POST(req);
    // The route catches all errors and returns 500
    expect(res.status).toBe(500);
  });
});

// ========================================================================
// GET /api/metrics
// ========================================================================

describe("GET /api/metrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("returns Prometheus text format content type", async () => {
    mockSerializeMetrics.mockReturnValue("# HELP titan_uptime_seconds\n");
    const { GET } = await import("@/app/api/metrics/route");
    const res = await GET(createSystemRequest("/api/metrics"));
    expect(res.headers.get("Content-Type")).toBe(
      "text/plain; version=0.0.4; charset=utf-8"
    );
  });

  it("returns serialized metrics in response body", async () => {
    const metricsText = [
      "# HELP titan_http_requests_total Total HTTP requests",
      "# TYPE titan_http_requests_total counter",
      'titan_http_requests_total{method="GET",route="/api/health",status="200"} 42',
      "# HELP titan_uptime_seconds Process uptime in seconds",
      "# TYPE titan_uptime_seconds gauge",
      "titan_uptime_seconds 3600",
      "",
    ].join("\n");

    mockSerializeMetrics.mockReturnValue(metricsText);
    const { GET } = await import("@/app/api/metrics/route");
    const res = await GET(createSystemRequest("/api/metrics"));
    const body = await res.text();
    expect(body).toBe(metricsText);
    expect(body).toContain("titan_http_requests_total");
    expect(body).toContain("titan_uptime_seconds");
  });

  it("calls serializeMetrics exactly once", async () => {
    mockSerializeMetrics.mockReturnValue("");
    const { GET } = await import("@/app/api/metrics/route");
    await GET(createSystemRequest("/api/metrics"));
    expect(mockSerializeMetrics).toHaveBeenCalledTimes(1);
  });

  it("returns 200 status", async () => {
    mockSerializeMetrics.mockReturnValue("");
    const { GET } = await import("@/app/api/metrics/route");
    const res = await GET(createSystemRequest("/api/metrics"));
    expect(res.status).toBe(200);
  });
});
