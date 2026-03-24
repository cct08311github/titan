import { ZodSchema, ZodError } from "zod";
import { ValidationError } from "@/services/errors";

/**
 * Parses and validates request body against a Zod schema.
 * Throws ValidationError (caught by route handlers) on failure.
 */
export function validateBody<T>(schema: ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const flat = (result.error as ZodError).flatten();
    throw new ValidationError(
      JSON.stringify({
        error: "輸入驗證失敗",
        fields: flat.fieldErrors,
      })
    );
  }
  return result.data;
}
