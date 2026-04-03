/**
 * @jest-environment node
 */
/**
 * Mobile Version Check Middleware Tests — Issue #1090
 *
 * Tests the X-App-Version header check for mobile API endpoints.
 * Ensures outdated mobile apps receive 426 Upgrade Required.
 */

import { NextRequest } from "next/server";
import { checkMobileVersion } from "@/lib/middleware/mobile-version";

function createRequest(pathname: string, appVersion?: string): NextRequest {
  const url = `http://localhost:3100${pathname}`;
  const headers: Record<string, string> = {};
  if (appVersion !== undefined) {
    headers["x-app-version"] = appVersion;
  }
  return new NextRequest(url, { headers });
}

describe("Mobile Version Check — Issue #1090", () => {
  const originalEnv = process.env.MIN_MOBILE_VERSION;

  beforeEach(() => {
    process.env.MIN_MOBILE_VERSION = "1.2.0";
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env.MIN_MOBILE_VERSION = originalEnv;
    } else {
      delete process.env.MIN_MOBILE_VERSION;
    }
  });

  describe("non-mobile endpoints", () => {
    it("passes through for web API routes", () => {
      const req = createRequest("/api/tasks", "0.1.0");
      expect(checkMobileVersion(req)).toBeNull();
    });

    it("passes through for page routes", () => {
      const req = createRequest("/dashboard");
      expect(checkMobileVersion(req)).toBeNull();
    });

    it("passes through for web auth routes", () => {
      const req = createRequest("/api/auth/callback/credentials");
      expect(checkMobileVersion(req)).toBeNull();
    });
  });

  describe("mobile endpoints — version enforcement", () => {
    it("returns 426 when X-App-Version header is missing", async () => {
      const req = createRequest("/api/auth/mobile/login");
      const res = checkMobileVersion(req);

      expect(res).not.toBeNull();
      expect(res!.status).toBe(426);
      const body = await res!.json();
      expect(body.error).toBe("UpgradeRequired");
      expect(body.minimumVersion).toBe("1.2.0");
    });

    it("returns 426 when version is below minimum", async () => {
      const req = createRequest("/api/auth/mobile/login", "1.1.9");
      const res = checkMobileVersion(req);

      expect(res).not.toBeNull();
      expect(res!.status).toBe(426);
      const body = await res!.json();
      expect(body.error).toBe("UpgradeRequired");
      expect(body.message).toContain("1.1.9");
      expect(body.message).toContain("1.2.0");
    });

    it("returns 426 for major version below minimum", async () => {
      const req = createRequest("/api/auth/mobile/logout", "0.9.0");
      const res = checkMobileVersion(req);

      expect(res).not.toBeNull();
      expect(res!.status).toBe(426);
    });

    it("passes through when version equals minimum", () => {
      const req = createRequest("/api/auth/mobile/login", "1.2.0");
      expect(checkMobileVersion(req)).toBeNull();
    });

    it("passes through when version exceeds minimum", () => {
      const req = createRequest("/api/auth/mobile/login", "1.3.0");
      expect(checkMobileVersion(req)).toBeNull();
    });

    it("passes through for higher major version", () => {
      const req = createRequest("/api/auth/mobile/login", "2.0.0");
      expect(checkMobileVersion(req)).toBeNull();
    });

    it("passes through for higher patch version", () => {
      const req = createRequest("/api/auth/mobile/login", "1.2.1");
      expect(checkMobileVersion(req)).toBeNull();
    });
  });

  describe("invalid version formats", () => {
    it("returns 426 for non-semver version string", async () => {
      const req = createRequest("/api/auth/mobile/login", "abc");
      const res = checkMobileVersion(req);

      expect(res).not.toBeNull();
      expect(res!.status).toBe(426);
      const body = await res!.json();
      expect(body.message).toContain("無效的版本格式");
    });

    it("returns 426 for partial version (major only)", async () => {
      const req = createRequest("/api/auth/mobile/login", "1");
      const res = checkMobileVersion(req);

      expect(res).not.toBeNull();
      expect(res!.status).toBe(426);
    });

    it("returns 426 for version with pre-release suffix", async () => {
      const req = createRequest("/api/auth/mobile/login", "1.2.0-beta");
      const res = checkMobileVersion(req);

      expect(res).not.toBeNull();
      expect(res!.status).toBe(426);
    });

    it("returns 426 for empty version string", async () => {
      const req = createRequest("/api/auth/mobile/login", "");
      const res = checkMobileVersion(req);

      expect(res).not.toBeNull();
      expect(res!.status).toBe(426);
    });
  });

  describe("edge cases", () => {
    it("handles version comparison at patch boundary", () => {
      const req = createRequest("/api/auth/mobile/login", "1.1.999");
      const res = checkMobileVersion(req);
      // 1.1.999 < 1.2.0 → should be rejected
      expect(res).not.toBeNull();
      expect(res!.status).toBe(426);
    });

    it("applies to all mobile sub-paths", () => {
      const req = createRequest("/api/auth/mobile/refresh", "0.1.0");
      const res = checkMobileVersion(req);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(426);
    });
  });
});
