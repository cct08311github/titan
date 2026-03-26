/**
 * Password policy constants and validation — Issue #180, enhanced #796 (AU-2)
 *
 * 金管會資安管理辦法 + ISO 27001 A.9.4.3:
 *   - 最少 12 字元
 *   - 至少 1 大寫英文
 *   - 至少 1 小寫英文
 *   - 至少 1 數字
 *   - 至少 1 特殊字元
 *   - 不可包含使用者帳號名稱 (Issue #796)
 *   - 不可為常見弱密碼 (Issue #796)
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

/** Common weak passwords blacklist — Issue #796 */
const COMMON_PASSWORDS = new Set([
  "password123!", "Password123!", "P@ssword1234", "Qwerty12345!",
  "Admin@123456", "Welcome@1234", "Changeme123!", "Letmein@1234",
  "123456789Ab!", "Abc@12345678", "Password!234", "Titan@123456",
  "Test@1234567", "Default@1234",
]);

/**
 * Validates a password against the full policy.
 * Returns an array of failed rule messages (empty = valid).
 */
export function validatePassword(password: string): string[] {
  const failures: string[] = PASSWORD_RULES.filter((rule) => !rule.regex.test(password)).map(
    (rule) => rule.message as string
  );

  // Check common passwords blacklist
  if (COMMON_PASSWORDS.has(password)) {
    failures.push("此密碼過於常見，請選擇更安全的密碼");
  }

  return failures;
}

/**
 * Validate password with email context (Issue #796).
 * Checks all rules + email local part inclusion.
 */
export function validatePasswordWithEmail(password: string, email: string): string[] {
  const failures = validatePassword(password);

  // Check if password contains email local part
  if (email) {
    const localPart = email.split("@")[0]?.toLowerCase();
    if (localPart && localPart.length >= 3 && password.toLowerCase().includes(localPart)) {
      failures.push("密碼不可包含您的帳號名稱");
    }
  }

  return failures;
}

/**
 * Returns true if the password meets all policy requirements.
 */
export function isPasswordValid(password: string): boolean {
  return validatePassword(password).length === 0;
}

/**
 * Compute password strength score (0-4) for frontend indicator.
 * 0 = very weak, 1 = weak, 2 = fair, 3 = strong, 4 = very strong
 */
export function getPasswordStrength(password: string): {
  score: number;
  label: "弱" | "中" | "強";
  passedRules: number;
  totalRules: number;
} {
  const passedRules = PASSWORD_RULES.filter((rule) => rule.regex.test(password)).length;
  const totalRules = PASSWORD_RULES.length;

  let score: number;
  let label: "弱" | "中" | "強";

  if (passedRules <= 2) {
    score = 1;
    label = "弱";
  } else if (passedRules <= 4) {
    score = 2;
    label = "中";
  } else {
    score = 3;
    label = "強";
  }

  // Extra point for length > 16
  if (password.length >= 16 && passedRules === totalRules) {
    score = 4;
    label = "強";
  }

  return { score, label, passedRules, totalRules };
}
