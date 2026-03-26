"use client";

/**
 * Password Strength Indicator — Issue #796 (AU-2)
 *
 * Displays real-time password strength feedback (弱/中/強)
 * and lists which rules are satisfied/unsatisfied.
 */

import { useMemo } from "react";
import {
  PASSWORD_RULES,
  getPasswordStrength,
} from "@/lib/password-policy";

interface PasswordStrengthIndicatorProps {
  password: string;
  email?: string;
}

export function PasswordStrengthIndicator({
  password,
  email,
}: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const emailLocalPart = email?.split("@")[0]?.toLowerCase();
  const containsEmail =
    emailLocalPart &&
    emailLocalPart.length >= 3 &&
    password.toLowerCase().includes(emailLocalPart);

  if (!password) return null;

  const colorMap = {
    弱: "bg-red-500",
    中: "bg-yellow-500",
    強: "bg-green-500",
  };

  const widthMap = {
    弱: "w-1/3",
    中: "w-2/3",
    強: "w-full",
  };

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${colorMap[strength.label]} ${widthMap[strength.label]}`}
          />
        </div>
        <span className="text-xs font-medium min-w-[2rem]">
          {strength.label}
        </span>
      </div>

      {/* Rule checklist */}
      <ul className="text-xs space-y-0.5">
        {PASSWORD_RULES.map((rule, i) => {
          const passed = rule.regex.test(password);
          return (
            <li key={i} className={passed ? "text-green-600" : "text-gray-400"}>
              {passed ? "✓" : "○"} {rule.message}
            </li>
          );
        })}
        {containsEmail && (
          <li className="text-red-500">✗ 密碼不可包含您的帳號名稱</li>
        )}
      </ul>
    </div>
  );
}
