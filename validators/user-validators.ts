import { z } from "zod";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
  PASSWORD_POLICY_DESCRIPTION,
} from "@/lib/password-policy";

const RoleEnum = z.enum(["MANAGER", "ENGINEER"]);

/**
 * Zod refinement: validates password against full complexity policy.
 * 金管會 + ISO 27001 A.9.4.3 — Issue #180
 */
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `密碼至少 ${PASSWORD_MIN_LENGTH} 個字元`)
  .refine(
    (pw) => PASSWORD_RULES.every((rule) => rule.regex.test(pw)),
    { message: PASSWORD_POLICY_DESCRIPTION }
  );

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: passwordSchema,
  role: RoleEnum.optional().default("ENGINEER"),
  avatar: z.string().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: passwordSchema.optional(),
  avatar: z.string().optional(),
  role: RoleEnum.optional(),
  isActive: z.boolean().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
