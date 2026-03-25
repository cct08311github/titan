/**
 * @jest-environment node
 */
/**
 * Edge JWT verification tests — Issue #757
 *
 * TDD: Tests that checkEdgeJwt can decrypt Auth.js v5 JWE tokens.
 *
 * Since jose is ESM-only and cannot be imported directly in Jest,
 * we mock the jose module and test the HKDF key derivation logic
 * and the checkEdgeJwt flow separately.
 */

import { NextRequest } from "next/server";

const TEST_SECRET = "test-secret-must-be-at-least-32-characters-long!!";
const COOKIE_NAME = "authjs.session-token";

// Mock jose since it's ESM-only
const mockJwtDecrypt = jest.fn();
const mockJwtVerify = jest.fn();
jest.mock("jose", () => ({
  jwtDecrypt: (...args: unknown[]) => mockJwtDecrypt(...args),
  jwtVerify: (...args: unknown[]) => mockJwtVerify(...args),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

/**
 * Replicate Auth.js v5's HKDF key derivation using Web Crypto.
 * This is the EXPECTED correct behavior:
 *   hkdf("sha256", secret, salt=cookieName, info="Auth.js Generated Encryption Key (cookieName)", 64 bytes)
 */
async function authJsV5DeriveKey(secret: string, salt: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "HKDF",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: enc.encode(salt),
      info: enc.encode(`Auth.js Generated Encryption Key (${salt})`),
    },
    keyMaterial,
    512 // 64 bytes for A256CBC-HS512
  );
  return new Uint8Array(derivedBits);
}

describe("Edge JWT verification (Auth.js v5 compatible)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv, AUTH_SECRET: TEST_SECRET };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("HKDF key derivation", () => {
    it("should derive key using Auth.js v5 parameters (salt=cookieName, info includes salt)", async () => {
      // Setup: jwtDecrypt succeeds, capturing the key passed to it
      let capturedKey: Uint8Array | null = null;
      mockJwtDecrypt.mockImplementation(async (_token: string, key: Uint8Array) => {
        capturedKey = key;
        return { payload: { sub: "user-1" } };
      });

      const { checkEdgeJwt } = await import("@/lib/auth-depth");

      // Create a fake JWE token (5 dot-separated parts with enc header)
      const header = Buffer.from(JSON.stringify({ alg: "dir", enc: "A256CBC-HS512" })).toString("base64");
      const fakeToken = `${header}.iv.ciphertext.tag.aad`;

      const req = new NextRequest("http://localhost:3000/api/tasks", {
        headers: { cookie: `${COOKIE_NAME}=${fakeToken}` },
      });

      await checkEdgeJwt(req);

      // Verify jwtDecrypt was called
      expect(mockJwtDecrypt).toHaveBeenCalled();

      // The key should match Auth.js v5's HKDF derivation
      const expectedKey = await authJsV5DeriveKey(TEST_SECRET, COOKIE_NAME);
      expect(capturedKey).not.toBeNull();
      expect(Buffer.from(capturedKey!).toString("hex")).toBe(
        Buffer.from(expectedKey).toString("hex")
      );
    });

    it("should produce 64-byte key for A256CBC-HS512", async () => {
      let capturedKey: Uint8Array | null = null;
      mockJwtDecrypt.mockImplementation(async (_token: string, key: Uint8Array) => {
        capturedKey = key;
        return { payload: { sub: "user-1" } };
      });

      const { checkEdgeJwt } = await import("@/lib/auth-depth");

      const header = Buffer.from(JSON.stringify({ alg: "dir", enc: "A256CBC-HS512" })).toString("base64");
      const fakeToken = `${header}.iv.ciphertext.tag.aad`;

      const req = new NextRequest("http://localhost:3000/api/tasks", {
        headers: { cookie: `${COOKIE_NAME}=${fakeToken}` },
      });

      await checkEdgeJwt(req);

      expect(capturedKey).not.toBeNull();
      expect(capturedKey!.byteLength).toBe(64);
    });
  });

  describe("checkEdgeJwt flow", () => {
    it("should return null when JWE decryption succeeds", async () => {
      mockJwtDecrypt.mockResolvedValue({ payload: { sub: "user-1" } });

      const { checkEdgeJwt } = await import("@/lib/auth-depth");

      const header = Buffer.from(JSON.stringify({ alg: "dir", enc: "A256CBC-HS512" })).toString("base64");
      const fakeToken = `${header}.iv.ciphertext.tag.aad`;

      const req = new NextRequest("http://localhost:3000/api/tasks", {
        headers: { cookie: `${COOKIE_NAME}=${fakeToken}` },
      });

      const result = await checkEdgeJwt(req);
      expect(result).toBeNull();
    });

    it("should return 401 when JWE decryption fails", async () => {
      mockJwtDecrypt.mockRejectedValue(new Error("decryption failed"));

      const { checkEdgeJwt } = await import("@/lib/auth-depth");

      const header = Buffer.from(JSON.stringify({ alg: "dir", enc: "A256CBC-HS512" })).toString("base64");
      const fakeToken = `${header}.iv.ciphertext.tag.aad`;

      const req = new NextRequest("http://localhost:3000/api/tasks", {
        headers: { cookie: `${COOKIE_NAME}=${fakeToken}` },
      });

      const result = await checkEdgeJwt(req);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(401);
    });

    it("should return 401 when no token is present", async () => {
      const { checkEdgeJwt } = await import("@/lib/auth-depth");

      const req = new NextRequest("http://localhost:3000/api/tasks");
      const result = await checkEdgeJwt(req);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(401);
    });

    it("should return 401 when AUTH_SECRET is not set", async () => {
      delete process.env.AUTH_SECRET;
      delete process.env.NEXTAUTH_SECRET;

      const { checkEdgeJwt } = await import("@/lib/auth-depth");

      const header = Buffer.from(JSON.stringify({ alg: "dir", enc: "A256CBC-HS512" })).toString("base64");
      const fakeToken = `${header}.iv.ciphertext.tag.aad`;

      const req = new NextRequest("http://localhost:3000/api/tasks", {
        headers: { cookie: `${COOKIE_NAME}=${fakeToken}` },
      });

      const result = await checkEdgeJwt(req);
      expect(result).not.toBeNull();
      expect(result!.status).toBe(401);
    });

    it("should accept token from Authorization Bearer header", async () => {
      mockJwtDecrypt.mockResolvedValue({ payload: { sub: "user-1" } });

      const { checkEdgeJwt } = await import("@/lib/auth-depth");

      const header = Buffer.from(JSON.stringify({ alg: "dir", enc: "A256CBC-HS512" })).toString("base64");
      const fakeToken = `${header}.iv.ciphertext.tag.aad`;

      const req = new NextRequest("http://localhost:3000/api/tasks", {
        headers: { authorization: `Bearer ${fakeToken}` },
      });

      const result = await checkEdgeJwt(req);
      expect(result).toBeNull();
    });

    it("should handle JWS tokens with jwtVerify", async () => {
      mockJwtVerify.mockResolvedValue({ payload: { sub: "user-1" } });

      const { checkEdgeJwt } = await import("@/lib/auth-depth");

      // JWS header (no enc field)
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64");
      const fakeToken = `${header}.payload.signature`;

      const req = new NextRequest("http://localhost:3000/api/tasks", {
        headers: { cookie: `${COOKIE_NAME}=${fakeToken}` },
      });

      const result = await checkEdgeJwt(req);
      expect(result).toBeNull();
      expect(mockJwtVerify).toHaveBeenCalled();
    });
  });
});
