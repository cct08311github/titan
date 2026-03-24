import { ZodSchema, ZodError } from "zod";
import { ValidationError } from "@/services/errors";

/**
 * Parses and validates request body against a Zod schema.
 * Throws ValidationError (caught by route handlers) on failure.
 */
export function validateBody<T>(schema: ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const formatted = (result.error as ZodError).format();
    throw new ValidationError(JSON.stringify(formatted));
  }
  return result.data;
}
