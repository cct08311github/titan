/**
 * @jest-environment node
 */
/**
 * Password Strength Validation tests — Issue #796 (AU-2)
 */

describe("password-policy enhanced", () => {
  let validatePassword: typeof import("@/lib/password-policy").validatePassword;
  let validatePasswordWithEmail: typeof import("@/lib/password-policy").validatePasswordWithEmail;
  let getPasswordStrength: typeof import("@/lib/password-policy").getPasswordStrength;
  let isPasswordValid: typeof import("@/lib/password-policy").isPasswordValid;

  beforeAll(async () => {
    const mod = await import("@/lib/password-policy");
    validatePassword = mod.validatePassword;
    validatePasswordWithEmail = mod.validatePasswordWithEmail;
    getPasswordStrength = mod.getPasswordStrength;
    isPasswordValid = mod.isPasswordValid;
  });

  describe("basic rules", () => {
    it("accepts valid strong password", () => {
      expect(validatePassword("Titan@2026!x")).toEqual([]);
    });

    it("rejects short password", () => {
      const failures = validatePassword("Short1!");
      expect(failures.length).toBeGreaterThan(0);
    });

    it("rejects password without uppercase", () => {
      const failures = validatePassword("alllowercase1!x");
      expect(failures).toContain("至少 1 個大寫英文字母");
    });

    it("rejects password without lowercase", () => {
      const failures = validatePassword("ALLUPPERCASE1!X");
      expect(failures).toContain("至少 1 個小寫英文字母");
    });

    it("rejects password without digit", () => {
      const failures = validatePassword("NoDigitsHere!!");
      expect(failures).toContain("至少 1 個數字");
    });

    it("rejects password without special char", () => {
      const failures = validatePassword("NoSpecial12345a");
      expect(failures).toContain("至少 1 個特殊字元");
    });

    it("boundary: exactly 12 chars valid password passes", () => {
      expect(validatePassword("Abcdef1234!@")).toEqual([]);
    });
  });

  describe("common password blacklist", () => {
    it("rejects common password", () => {
      const failures = validatePassword("Password123!");
      expect(failures).toContain("此密碼過於常見，請選擇更安全的密碼");
    });

    it("accepts non-common password", () => {
      expect(validatePassword("Unique@Passw0rd!")).toEqual([]);
    });
  });

  describe("email local part check", () => {
    it("rejects password containing email local part", () => {
      const failures = validatePasswordWithEmail("Alice@12345!", "alice@example.com");
      expect(failures).toContain("密碼不可包含您的帳號名稱");
    });

    it("case-insensitive email check", () => {
      const failures = validatePasswordWithEmail("ALICE@12345!", "alice@example.com");
      expect(failures).toContain("密碼不可包含您的帳號名稱");
    });

    it("accepts password not containing email", () => {
      const failures = validatePasswordWithEmail("Str0ng!Pass@x", "bob@example.com");
      expect(failures).toEqual([]);
    });

    it("skips short local parts (< 3 chars)", () => {
      const failures = validatePasswordWithEmail("Ab@12345678!", "ab@example.com");
      expect(failures).not.toContain("密碼不可包含您的帳號名稱");
    });
  });

  describe("password strength score", () => {
    it("returns 弱 for weak password", () => {
      const s = getPasswordStrength("abc");
      expect(s.label).toBe("弱");
      expect(s.score).toBe(1);
    });

    it("returns 中 for medium password", () => {
      const s = getPasswordStrength("Abcdef1234");
      expect(s.label).toBe("中");
    });

    it("returns 強 for strong password", () => {
      const s = getPasswordStrength("Titan@2026!x");
      expect(s.label).toBe("強");
    });

    it("returns passedRules and totalRules", () => {
      const s = getPasswordStrength("Titan@2026!x");
      expect(s.passedRules).toBe(5);
      expect(s.totalRules).toBe(5);
    });
  });

  describe("isPasswordValid backward compat", () => {
    it("returns true for valid password", () => {
      expect(isPasswordValid("Titan@2026!x")).toBe(true);
    });
    it("returns false for weak password", () => {
      expect(isPasswordValid("weak")).toBe(false);
    });
  });
});

describe("shared password validator (Zod)", () => {
  let passwordSchema: typeof import("@/validators/shared/password").passwordSchema;

  beforeAll(async () => {
    const mod = await import("@/validators/shared/password");
    passwordSchema = mod.passwordSchema;
  });

  it("accepts valid password", () => {
    expect(passwordSchema.safeParse("Titan@2026!x").success).toBe(true);
  });

  it("rejects short password", () => {
    expect(passwordSchema.safeParse("Short1!").success).toBe(false);
  });
});
