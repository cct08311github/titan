import { createUserSchema, updateUserSchema, loginSchema } from "../user-validators";

describe("createUserSchema", () => {
  const validInput = {
    name: "Alice Chen",
    email: "alice@example.com",
    password: "securepassword123",
  };

  test("accepts valid user input", () => {
    const result = createUserSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  test("accepts user with optional role", () => {
    const result = createUserSchema.safeParse({
      ...validInput,
      role: "MANAGER",
    });
    expect(result.success).toBe(true);
  });

  test("accepts user with avatar", () => {
    const result = createUserSchema.safeParse({
      ...validInput,
      avatar: "https://example.com/avatar.png",
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing name", () => {
    const { name: _, ...rest } = validInput;
    const result = createUserSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test("rejects missing email", () => {
    const { email: _, ...rest } = validInput;
    const result = createUserSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test("rejects invalid email format", () => {
    const result = createUserSchema.safeParse({
      ...validInput,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing password", () => {
    const { password: _, ...rest } = validInput;
    const result = createUserSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test("rejects password too short (< 8 chars)", () => {
    const result = createUserSchema.safeParse({ ...validInput, password: "short" });
    expect(result.success).toBe(false);
  });

  test("rejects invalid role enum", () => {
    const result = createUserSchema.safeParse({ ...validInput, role: "ADMIN" });
    expect(result.success).toBe(false);
  });
});

describe("updateUserSchema", () => {
  test("accepts partial update with only name", () => {
    const result = updateUserSchema.safeParse({ name: "Bob" });
    expect(result.success).toBe(true);
  });

  test("accepts partial update with isActive", () => {
    const result = updateUserSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });

  test("accepts empty object", () => {
    const result = updateUserSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("rejects invalid email in update", () => {
    const result = updateUserSchema.safeParse({ email: "bad-email" });
    expect(result.success).toBe(false);
  });

  test("rejects invalid role in update", () => {
    const result = updateUserSchema.safeParse({ role: "SUPERUSER" });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  test("accepts valid credentials", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "mypassword",
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing email", () => {
    const result = loginSchema.safeParse({ password: "mypassword" });
    expect(result.success).toBe(false);
  });

  test("rejects missing password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(false);
  });

  test("rejects invalid email format", () => {
    const result = loginSchema.safeParse({
      email: "notanemail",
      password: "password",
    });
    expect(result.success).toBe(false);
  });

  test("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});
