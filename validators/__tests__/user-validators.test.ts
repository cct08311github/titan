import { createUserSchema, updateUserSchema } from "../user-validators";

// A valid password that meets the new policy: 12+ chars, upper, lower, digit, special
const STRONG_PASSWORD = "Titan@2026!x";

describe("createUserSchema", () => {
  const validInput = {
    name: "Alice Chen",
    email: "alice@example.com",
    password: STRONG_PASSWORD,
  };

  test("accepts valid input with strong password", () => {
    const result = createUserSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  test("rejects missing email", () => {
    const { email: _, ...rest } = validInput;
    const result = createUserSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test("rejects invalid email format", () => {
    const result = createUserSchema.safeParse({ ...validInput, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  test("rejects short password (< 12 chars)", () => {
    const result = createUserSchema.safeParse({ ...validInput, password: "Short1!" });
    expect(result.success).toBe(false);
  });

  test("rejects password without uppercase", () => {
    const result = createUserSchema.safeParse({ ...validInput, password: "alllowercase1!" });
    expect(result.success).toBe(false);
  });

  test("rejects password without lowercase", () => {
    const result = createUserSchema.safeParse({ ...validInput, password: "ALLUPPERCASE1!" });
    expect(result.success).toBe(false);
  });

  test("rejects password without digit", () => {
    const result = createUserSchema.safeParse({ ...validInput, password: "NoDigitsHere!!" });
    expect(result.success).toBe(false);
  });

  test("rejects password without special character", () => {
    const result = createUserSchema.safeParse({ ...validInput, password: "NoSpecial12345" });
    expect(result.success).toBe(false);
  });

  test("rejects missing name", () => {
    const { name: _, ...rest } = validInput;
    const result = createUserSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test("rejects invalid role", () => {
    const result = createUserSchema.safeParse({ ...validInput, role: "ADMIN" });
    expect(result.success).toBe(false);
  });
});

describe("updateUserSchema", () => {
  test("accepts partial update without password", () => {
    const result = updateUserSchema.safeParse({ name: "Bob" });
    expect(result.success).toBe(true);
  });

  test("accepts update with strong password", () => {
    const result = updateUserSchema.safeParse({ password: STRONG_PASSWORD });
    expect(result.success).toBe(true);
  });

  test("rejects update with weak password", () => {
    const result = updateUserSchema.safeParse({ password: "weak" });
    expect(result.success).toBe(false);
  });

  test("rejects update password without complexity", () => {
    const result = updateUserSchema.safeParse({ password: "simplelongpassword" });
    expect(result.success).toBe(false);
  });
});
