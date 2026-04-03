import { z } from "zod";
import { ValidationError } from "@/services/errors";

/**
 * Parses and validates request body against a Zod schema.
 * Throws ValidationError (caught by route handlers) on failure.
 *
 * Note: Zod 4 removed the named export `ZodSchema` — use `z.ZodType` instead.
 */
export function validateBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const flat = result.error.flatten();
    throw new ValidationError(
      JSON.stringify({
        error: "輸入驗證失敗",
        fields: flat.fieldErrors,
      })
    );
  }
  return result.data;
}
