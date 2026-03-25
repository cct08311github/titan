/**
 * User validators — re-exports from shared schemas (Issue #396)
 *
 * Kept for backward compatibility. New code should import from
 * '@/validators/shared' or '@/validators/shared/user' directly.
 */

export {
  createUserSchema,
  updateUserSchema,
  loginSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type LoginInput,
} from "./shared/user";
