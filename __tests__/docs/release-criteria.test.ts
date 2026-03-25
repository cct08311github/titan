/**
 * @file release-criteria.test.ts
 * TDD tests for docs/release-criteria.md
 *
 * Validates release criteria document covers all required categories.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

const DOC_PATH = join(process.cwd(), "docs", "release-criteria.md");

describe("docs/release-criteria.md", () => {
  it("should exist", () => {
    expect(existsSync(DOC_PATH)).toBe(true);
  });

  describe("content structure", () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(DOC_PATH, "utf-8");
    });

    // Five required categories
    it("should cover functionality criteria", () => {
      expect(content).toMatch(/功能|functionality/i);
    });

    it("should cover performance criteria", () => {
      expect(content).toMatch(/效能|performance/i);
    });

    it("should cover security criteria", () => {
      expect(content).toMatch(/安全|security/i);
    });

    it("should cover data integrity criteria", () => {
      expect(content).toMatch(/資料完整性|data.*integrity/i);
    });

    it("should cover rollback plan", () => {
      expect(content).toMatch(/回滾|rollback/i);
    });

    // Each item should have verification method
    it("should include verification methods", () => {
      expect(content).toMatch(/驗證方法|how.*verify|verification/i);
    });

    // Should have pass/fail status column
    it("should include pass/fail status tracking", () => {
      expect(content).toMatch(/通過|pass|fail|狀態|status/i);
    });

    // Should have criteria descriptions
    it("should include criteria descriptions", () => {
      expect(content).toMatch(/標準|criteria|門檻/i);
    });

    // Should have Go/No-Go decision mechanism
    it("should define Go/No-Go decision rules", () => {
      expect(content).toMatch(/Go.*No-Go|決策|decision/i);
    });

    // Should have checkbox items
    it("should have checkbox items for tracking", () => {
      const checkboxCount = (content.match(/- \[ \]/g) || []).length;
      expect(checkboxCount).toBeGreaterThanOrEqual(10);
    });
  });
});
