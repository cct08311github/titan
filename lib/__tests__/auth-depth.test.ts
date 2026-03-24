/**
 * @jest-environment node
 */
/**
 * TDD: Tests written FIRST (RED) before implementation.
 * Issue #129: Auth Defense in Depth — Edge JWT + route-level DB session check
 *
 * Two-layer security model:
 *   Layer 1 (Edge / middleware.ts): lightweight JWT verification via NEXTAUTH_SECRET
 *   Layer 2 (Node.js / route handlers): full DB session check via withAuth/withManager
 *
 * These tests cover the Edge JWT middleware behaviour.
 * Route-handler DB session tests confirm the existing withAuth/withManager still run.
 */

import { NextRequest, NextResponse } from "next/server";

// ── Mock jose (JWT verification) ────────────────────────────────────────────
const mockJwtVerify = jest.fn();
jest.mock("jose", () => ({
  jwtVerify: (...args: unknown[]) => mockJwtVerify(...args),
  createRemoteJWKSet: jest.fn(),
}));

// ── Mock next-auth (DB session — used by route handlers) ────────────────────
const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

// ── Mock logger ─────────────────────────────────────────────────────────────
const mockLoggerWarn = jest.fn();
jest.mock("@/lib/logger", () => ({
  logger: {
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ── Import after mocks ───────────────────────────────────────────────────────
import { checkEdgeJwt } from "@/lib/auth-depth";

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeRequest(
  url = "http://localhost/api/tasks",
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(url, { headers });
}

function bearerToken(token = "valid.jwt.token"): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

function cookieToken(token = "valid.jwt.token"): Record<string, string> {
  return { cookie: `next-auth.session-token=${token}` };
}

const VALID_PAYLOAD = {
  sub: "user-1",
  role: "ENGINEER",
  iat: Math.floor(Date.now() / 1000) - 60,
  exp: Math.floor(Date.now() / 1000) + 3600,
};

// ── describe: checkEdgeJwt ───────────────────────────────────────────────────

describe("checkEdgeJwt — Edge JWT verification", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, NEXTAUTH_SECRET: "test-secret-32-chars-padded-x" };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  // ── Test 1: blocks request without JWT ──────────────────────────────────

  test("blocks request without JWT — returns 401 NextResponse", async () => {
    const req = makeRequest("http://localhost/api/tasks");
    // no Authorization header, no cookie

    const result = await checkEdgeJwt(req);

    expect(result).toBeInstanceOf(NextResponse);
    expect(result!.status).toBe(401);
  });

  test("logs a warning when blocking request without JWT", async () => {
    const req = makeRequest("http://localhost/api/tasks");

    await checkEdgeJwt(req);

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.any(String) }),
      expect.stringContaining("middleware")
    );
  });

  // ── Test 2: allows valid JWT ─────────────────────────────────────────────

  test("allows request with valid JWT Bearer token — returns null (continue)", async () => {
    mockJwtVerify.mockResolvedValue({ payload: VALID_PAYLOAD });
    const req = makeRequest("http://localhost/api/tasks", bearerToken());

    const result = await checkEdgeJwt(req);

    expect(result).toBeNull();
  });

  test("allows request with valid JWT in session cookie — returns null (continue)", async () => {
    mockJwtVerify.mockResolvedValue({ payload: VALID_PAYLOAD });
    const req = makeRequest("http://localhost/api/tasks", cookieToken());

    const result = await checkEdgeJwt(req);

    expect(result).toBeNull();
  });

  // ── Test 3: expired JWT is rejected ──────────────────────────────────────

  test("rejects expired JWT — returns 401 NextResponse", async () => {
    mockJwtVerify.mockRejectedValue(
      Object.assign(new Error("JWTExpired"), { code: "ERR_JWT_EXPIRED" })
    );
    const req = makeRequest("http://localhost/api/tasks", bearerToken("expired.jwt.token"));

    const result = await checkEdgeJwt(req);

    expect(result).toBeInstanceOf(NextResponse);
    expect(result!.status).toBe(401);
  });

  test("logs a warning when JWT is expired", async () => {
    mockJwtVerify.mockRejectedValue(
      Object.assign(new Error("JWTExpired"), { code: "ERR_JWT_EXPIRED" })
    );
    const req = makeRequest("http://localhost/api/tasks", bearerToken("expired.jwt.token"));

    await checkEdgeJwt(req);

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.any(String) }),
      expect.stringContaining("middleware")
    );
  });

  // ── Test 4: invalid JWT signature is rejected ─────────────────────────────

  test("rejects JWT with invalid signature — returns 401 NextResponse", async () => {
    mockJwtVerify.mockRejectedValue(
      Object.assign(new Error("JWSSignatureVerificationFailed"), {
        code: "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
      })
    );
    const req = makeRequest("http://localhost/api/tasks", bearerToken("tampered.jwt.token"));

    const result = await checkEdgeJwt(req);

    expect(result).toBeInstanceOf(NextResponse);
    expect(result!.status).toBe(401);
  });

  test("logs a warning when JWT signature is invalid", async () => {
    mockJwtVerify.mockRejectedValue(
      Object.assign(new Error("JWSSignatureVerificationFailed"), {
        code: "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
      })
    );
    const req = makeRequest("http://localhost/api/tasks", bearerToken("tampered.jwt.token"));

    await checkEdgeJwt(req);

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.any(String) }),
      expect.stringContaining("middleware")
    );
  });

  // ── Test 5: route handler still validates DB session (defense in depth) ───

  test("route-handler DB session check still runs after Edge JWT passes", async () => {
    // Simulate: Edge JWT passes (returns null) but route handler re-validates via DB
    mockJwtVerify.mockResolvedValue({ payload: VALID_PAYLOAD });
    mockGetServerSession.mockResolvedValue(null); // DB session does NOT exist

    const req = makeRequest("http://localhost/api/tasks", bearerToken());

    // Edge middleware passes (null = continue)
    const edgeResult = await checkEdgeJwt(req);
    expect(edgeResult).toBeNull();

    // Route handler's DB session check is independent and would catch the missing session
    const { requireAuth } = await import("@/lib/rbac");
    await expect(requireAuth()).rejects.toThrow("未授權");
  });

  // ── Additional: NEXTAUTH_SECRET missing ──────────────────────────────────

  test("blocks all requests when NEXTAUTH_SECRET is not configured", async () => {
    delete process.env.NEXTAUTH_SECRET;
    const req = makeRequest("http://localhost/api/tasks", bearerToken());

    const result = await checkEdgeJwt(req);

    expect(result).toBeInstanceOf(NextResponse);
    expect(result!.status).toBe(401);
  });
});
