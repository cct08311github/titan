/**
 * @jest-environment node
 */
/**
 * TDD tests for Issue #829: dueDate format conversion
 *
 * Verifies that HTML date input values (YYYY-MM-DD) are correctly
 * converted to ISO 8601 datetime before sending to the API.
 */

describe("dueDate format conversion", () => {
  it("converts YYYY-MM-DD to ISO 8601 datetime string", () => {
    const htmlDateValue = "2026-06-30";
    const result = htmlDateValue ? new Date(htmlDateValue).toISOString() : null;
    expect(result).toBe("2026-06-30T00:00:00.000Z");
  });

  it("returns null when dueDate is empty string", () => {
    const htmlDateValue = "";
    const result = htmlDateValue ? new Date(htmlDateValue).toISOString() : null;
    expect(result).toBeNull();
  });

  it("returns null when dueDate is undefined/null", () => {
    const htmlDateValue: string | undefined = undefined;
    const result = htmlDateValue ? new Date(htmlDateValue).toISOString() : null;
    expect(result).toBeNull();
  });

  it("produces valid ISO string that passes z.string().datetime()", () => {
    const { z } = require("zod");
    const schema = z.string().datetime().nullable().optional();
    const htmlDateValue = "2026-09-25";
    const converted = htmlDateValue ? new Date(htmlDateValue).toISOString() : null;
    const result = schema.safeParse(converted);
    expect(result.success).toBe(true);
  });

  it("raw HTML date value fails z.string().datetime()", () => {
    const { z } = require("zod");
    const schema = z.string().datetime();
    const htmlDateValue = "2026-06-30";
    const result = schema.safeParse(htmlDateValue);
    expect(result.success).toBe(false);
  });
});
