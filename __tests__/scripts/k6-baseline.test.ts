/**
 * @file k6-baseline.test.ts
 * TDD tests for scripts/k6/baseline.js
 *
 * Validates k6 load test script structure:
 * 1. File exists
 * 2. Defines thresholds (p95 < 200ms)
 * 3. Covers login, dashboard, timesheet CRUD scenarios
 * 4. Uses k6 standard patterns (options, default export)
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

const SCRIPT_PATH = join(process.cwd(), "scripts", "k6", "baseline.js");

describe("k6/baseline.js", () => {
  it("should exist", () => {
    expect(existsSync(SCRIPT_PATH)).toBe(true);
  });

  describe("script content", () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(SCRIPT_PATH, "utf-8");
    });

    it("should import from k6/http", () => {
      expect(content).toMatch(/from\s+['"]k6\/http['"]/);
    });

    it("should import check from k6", () => {
      expect(content).toMatch(/from\s+['"]k6['"]/);
    });

    it("should export options with thresholds", () => {
      expect(content).toMatch(/export\s+(const|let|var)\s+options/);
      expect(content).toMatch(/thresholds/);
    });

    it("should set p95 threshold under 200ms", () => {
      expect(content).toMatch(/p\(95\).*<.*200/);
    });

    it("should have a default export function", () => {
      expect(content).toMatch(/export\s+default\s+function/);
    });

    it("should test login endpoint", () => {
      expect(content).toMatch(/login|auth.*signin|\/api\/auth/i);
    });

    it("should test dashboard endpoint", () => {
      expect(content).toMatch(/dashboard/i);
    });

    it("should test timesheet CRUD operations", () => {
      expect(content).toMatch(/time-entries|timesheet/i);
      // Should have GET and POST at minimum
      expect(content).toMatch(/http\.(get|post|put|del|patch)/i);
    });

    it("should define test stages (ramp up/down)", () => {
      expect(content).toMatch(/stages/);
    });

    it("should use configurable base URL", () => {
      expect(content).toMatch(/BASE_URL|baseUrl|__ENV/);
    });
  });
});
