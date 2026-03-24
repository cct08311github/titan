import { createUserSchema, updateUserSchema } from "../user-validators";

describe("createUserSchema", () => {
  const validInput = {
    name: "Alice Chen",
    email: "alice@example.com",
    password: "securepassword123",
  };

  test("accepts valid input", () => {
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

  test("rejects short password (< 8 chars)", () => {
    const result = createUserSchema.safeParse({ ...validInput, password: "short" });
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
