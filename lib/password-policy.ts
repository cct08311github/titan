/**
 * Password policy constants and validation — Issue #180
 *
 * 金管會資安管理辦法 + ISO 27001 A.9.4.3:
 *   - 最少 12 字元
 *   - 至少 1 大寫英文
 *   - 至少 1 小寫英文
 *   - 至少 1 數字
 *   - 至少 1 特殊字元
 */

export const PASSWORD_MIN_LENGTH = 12;

export const PASSWORD_RULES = [
  { regex: /.{12,}/, message: "至少 12 個字元" },
  { regex: /[A-Z]/, message: "至少 1 個大寫英文字母" },
  { regex: /[a-z]/, message: "至少 1 個小寫英文字母" },
  { regex: /[0-9]/, message: "至少 1 個數字" },
  { regex: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/, message: "至少 1 個特殊字元" },
] as const;

export const PASSWORD_POLICY_DESCRIPTION =
  "密碼須至少 12 字元，包含大寫、小寫、數字及特殊字元";

/**
 * Validates a password against the full policy.
 * Returns an array of failed rule messages (empty = valid).
 */
export function validatePassword(password: string): string[] {
  return PASSWORD_RULES.filter((rule) => !rule.regex.test(password)).map(
    (rule) => rule.message
  );
}

/**
 * Returns true if the password meets all policy requirements.
 */
export function isPasswordValid(password: string): boolean {
  return validatePassword(password).length === 0;
}
