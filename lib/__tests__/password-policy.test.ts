import { validatePassword, isPasswordValid, PASSWORD_MIN_LENGTH } from "../password-policy";

describe("password-policy", () => {
  describe("validatePassword", () => {
    test("returns empty array for fully compliant password", () => {
      expect(validatePassword("Titan@2026!x")).toEqual([]);
    });

    test("flags missing uppercase", () => {
      const errors = validatePassword("alllowercase1!");
      expect(errors).toContain("至少 1 個大寫英文字母");
    });

    test("flags missing lowercase", () => {
      const errors = validatePassword("ALLUPPERCASE1!");
      expect(errors).toContain("至少 1 個小寫英文字母");
    });

    test("flags missing digit", () => {
      const errors = validatePassword("NoDigitsHere!!");
      expect(errors).toContain("至少 1 個數字");
    });

    test("flags missing special character", () => {
      const errors = validatePassword("NoSpecial12345");
      expect(errors).toContain("至少 1 個特殊字元");
    });

    test("flags too short password", () => {
      const errors = validatePassword("Sh0rt!");
      expect(errors).toContain(`至少 ${PASSWORD_MIN_LENGTH} 個字元`);
    });

    test("returns multiple errors for very weak password", () => {
      const errors = validatePassword("abc");
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("isPasswordValid", () => {
    test("returns true for compliant password", () => {
      expect(isPasswordValid("SecureP@ss2026")).toBe(true);
    });

    test("returns false for non-compliant password", () => {
      expect(isPasswordValid("weak")).toBe(false);
    });
  });
});
