/**
 * @jest-environment node
 */
/**
 * TDD: Tests written FIRST (RED) before implementation.
 * Issue #82: Structured logging with pino
 */

// ── logger tests ─────────────────────────────────────────────────────────

describe("logger", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  /**
   * Helper: capture pino stdout output for one action.
   * pino writes newline-terminated JSON to stdout.
   */
  async function captureLog(action: (log: import("@/lib/logger").Logger) => void): Promise<Record<string, unknown>[]> {
    const entries: Record<string, unknown>[] = [];
    const spy = jest.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      const str = typeof chunk === "string" ? chunk : chunk.toString();
      for (const line of str.split("\n")) {
        const trimmed = line.trim();
        if (trimmed) {
          try {
            entries.push(JSON.parse(trimmed));
          } catch {
            // ignore non-JSON output
          }
        }
      }
      return true;
    });
    jest.resetModules();
    const { logger } = await import("@/lib/logger");
    action(logger);
    spy.mockRestore();
    return entries;
  }

  test("logs info level messages", async () => {
    const entries = await captureLog((logger) => logger.info("hello world"));
    expect(entries.length).toBeGreaterThan(0);
    const entry = entries[0];
    expect(entry.msg).toBe("hello world");
    // pino encodes level 30 = info
    expect(entry.level === 30 || entry.level === "info").toBe(true);
  });

  test("logs error level with stack trace", async () => {
    const err = new Error("something failed");
    const entries = await captureLog((logger) => logger.error({ err }, "error occurred"));
    expect(entries.length).toBeGreaterThan(0);
    const entry = entries[0];
    expect(entry.msg).toBe("error occurred");
    const errField = entry.err as Record<string, unknown>;
    expect(errField).toBeDefined();
    expect(errField.message).toBe("something failed");
    expect(typeof errField.stack).toBe("string");
  });

  test("includes timestamp", async () => {
    const entries = await captureLog((logger) => logger.info("timestamp test"));
    const entry = entries[0];
    expect(entry.time).toBeDefined();
    expect(typeof entry.time).toBe("number");
  });

  test("includes request context (method, path, userId)", async () => {
    const entries = await captureLog((logger) =>
      logger.info({ method: "GET", path: "/api/users", userId: "u_123" }, "request context")
    );
    const entry = entries[0];
    expect(entry.method).toBe("GET");
    expect(entry.path).toBe("/api/users");
    expect(entry.userId).toBe("u_123");
  });

  test("does not log sensitive data (passwords, tokens)", async () => {
    jest.resetModules();
    const { sanitizeData } = await import("@/lib/logger");
    const result = sanitizeData({
      username: "alice",
      password: "secret123",
      token: "bearer-xyz",
      accessToken: "abc",
      data: "safe",
    });
    expect(result.username).toBe("alice");
    expect(result.data).toBe("safe");
    expect(result.password).toBe("[REDACTED]");
    expect(result.token).toBe("[REDACTED]");
    expect(result.accessToken).toBe("[REDACTED]");
  });
});

// ── requestLogger middleware tests ────────────────────────────────────────

describe("requestLogger middleware", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  function makeRequest(opts: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
  }) {
    const { method = "GET", url = "http://localhost/api/test", headers = {} } = opts;
    return {
      method,
      url,
      headers: {
        get: (key: string) => headers[key.toLowerCase()] ?? null,
        forEach: (cb: (value: string, key: string) => void) => {
          for (const [k, v] of Object.entries(headers)) {
            cb(v, k);
          }
        },
      },
    } as unknown as import("next/server").NextRequest;
  }

  function makeResponse(status: number) {
    return { status, headers: new Headers() } as unknown as import("next/server").NextResponse;
  }

  async function captureRequestLog(
    req: import("next/server").NextRequest,
    res: import("next/server").NextResponse
  ): Promise<Record<string, unknown>[]> {
    const entries: Record<string, unknown>[] = [];
    const spy = jest.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      const str = typeof chunk === "string" ? chunk : chunk.toString();
      for (const line of str.split("\n")) {
        const trimmed = line.trim();
        if (trimmed) {
          try {
            entries.push(JSON.parse(trimmed));
          } catch {
            // ignore
          }
        }
      }
      return true;
    });
    jest.resetModules();
    const { requestLogger } = await import("@/lib/request-logger");
    await requestLogger(req, async () => res);
    spy.mockRestore();
    return entries;
  }

  test("logs request method and path", async () => {
    const req = makeRequest({ method: "POST", url: "http://localhost/api/users" });
    const res = makeResponse(201);
    const entries = await captureRequestLog(req, res);
    const entry = entries.find((e) => e.method === "POST");
    expect(entry).toBeDefined();
    expect(entry!.method).toBe("POST");
    expect(entry!.path).toBe("/api/users");
  });

  test("logs response status code", async () => {
    const req = makeRequest({ method: "GET", url: "http://localhost/api/items" });
    const res = makeResponse(200);
    const entries = await captureRequestLog(req, res);
    const entry = entries.find((e) => typeof e.status === "number");
    expect(entry).toBeDefined();
    expect(entry!.status).toBe(200);
  });

  test("logs response duration in ms", async () => {
    const req = makeRequest({});
    const res = makeResponse(200);
    const entries = await captureRequestLog(req, res);
    const entry = entries.find((e) => typeof e.durationMs === "number");
    expect(entry).toBeDefined();
    expect(entry!.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("logs userId from session header", async () => {
    const req = makeRequest({
      url: "http://localhost/api/profile",
      headers: { "x-user-id": "u_999" },
    });
    const res = makeResponse(200);
    const entries = await captureRequestLog(req, res);
    const entry = entries.find((e) => e.userId === "u_999");
    expect(entry).toBeDefined();
    expect(entry!.userId).toBe("u_999");
  });

  test("masks sensitive headers (authorization, cookie)", async () => {
    const req = makeRequest({
      headers: {
        authorization: "Bearer secret-token",
        cookie: "session=abc123",
        "content-type": "application/json",
      },
    });
    const res = makeResponse(200);
    const entries = await captureRequestLog(req, res);
    const allOutput = JSON.stringify(entries);
    expect(allOutput).not.toContain("secret-token");
    expect(allOutput).not.toContain("abc123");
  });
});
