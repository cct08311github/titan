/**
 * @file uat-checklist.test.ts
 * TDD tests for docs/uat-checklist.md
 *
 * Validates UAT checklist covers all Sprint 1+2 features.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

const DOC_PATH = join(process.cwd(), "docs", "uat-checklist.md");

describe("docs/uat-checklist.md", () => {
  it("should exist", () => {
    expect(existsSync(DOC_PATH)).toBe(true);
  });

  describe("content coverage", () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(DOC_PATH, "utf-8");
    });

    // Sprint 1 features
    it("should cover login/authentication", () => {
      expect(content).toMatch(/登入|login|auth/i);
    });

    it("should cover timesheet CRUD", () => {
      expect(content).toMatch(/工時.*CRUD|timesheet.*CRUD|新增.*工時|建立.*工時/i);
    });

    it("should cover timer functionality", () => {
      expect(content).toMatch(/計時器|timer/i);
    });

    it("should cover Kimai import", () => {
      expect(content).toMatch(/Kimai.*匯入|Kimai.*import/i);
    });

    it("should cover overtime marking", () => {
      expect(content).toMatch(/加班|overtime/i);
    });

    it("should cover color categories", () => {
      expect(content).toMatch(/顏色|color.*categor/i);
    });

    it("should cover daily subtotal", () => {
      expect(content).toMatch(/每日.*小計|daily.*subtotal|日小計/i);
    });

    it("should cover keyboard navigation", () => {
      expect(content).toMatch(/鍵盤|keyboard/i);
    });

    // Sprint 2 features
    it("should cover monthly settlement", () => {
      expect(content).toMatch(/月結|monthly.*settl/i);
    });

    it("should cover compliance export", () => {
      expect(content).toMatch(/合規.*匯出|compliance.*export/i);
    });

    it("should cover templates", () => {
      expect(content).toMatch(/範本|template/i);
    });

    // Structure checks
    it("should have checkbox items for verification", () => {
      const checkboxCount = (content.match(/- \[ \]/g) || []).length;
      expect(checkboxCount).toBeGreaterThanOrEqual(15);
    });

    it("should include expected results for test items", () => {
      expect(content).toMatch(/預期結果|expected|應該|should/i);
    });
  });
});
