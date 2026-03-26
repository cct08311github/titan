/**
 * Shared password validation schema — Issue #796 (AU-2)
 *
 * Used by both frontend and backend. Exports a Zod schema
 * and a context-aware validator that checks email inclusion.
 */

import { z } from "zod";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
  PASSWORD_POLICY_DESCRIPTION,
  validatePasswordWithEmail,
} from "@/lib/password-policy";

/**
 * Basic password schema (no email context).
 * For forms where email is not available.
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `密碼至少 ${PASSWORD_MIN_LENGTH} 個字元`)
  .refine(
    (pw) => PASSWORD_RULES.every((rule) => rule.regex.test(pw)),
    { message: PASSWORD_POLICY_DESCRIPTION }
  );

/**
 * Password + email validation (with email local part check).
 * Use this in registration/change-password forms.
 */
export const passwordWithEmailSchema = z.object({
  password: z.string().min(PASSWORD_MIN_LENGTH),
  email: z.string().email(),
}).refine(
  (data) => validatePasswordWithEmail(data.password, data.email).length === 0,
  {
    message: "密碼不符合安全規則",
    path: ["password"],
  }
);

export type PasswordInput = z.infer<typeof passwordSchema>;
