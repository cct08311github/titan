/**
 * 月加班時數計算與警示門檻
 *
 * 台灣勞基法：
 * - 每月加班上限 46 小時（一般情況）
 * - 特殊情況上限 54 小時（需勞資會議同意）
 * - 此模組計算當月加班時數並判定警示等級
 */

// ─── Config ─────────────────────────────────────────────────────────────────

export const OVERTIME_CONFIG = {
  /** 黃色警告門檻（時） */
  WARNING_THRESHOLD: 36,
  /** 法定上限（時） */
  LIMIT: 46,
  /** 特殊上限（時），需勞資會議同意 */
  SPECIAL_LIMIT: 54,
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export type OvertimeLevel = "safe" | "warning" | "danger";

export type OvertimeInfo = {
  /** 當月加班時數 */
  overtimeHours: number;
  /** 警示等級 */
  level: OvertimeLevel;
  /** 法定上限 */
  limit: number;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * 計算指定月份的工作天數（排除週六日）
 */
export function getWorkingDaysInMonth(year: number, month: number): number {
  // month is 0-based (0 = January)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let workingDays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dayOfWeek = new Date(year, month, day).getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
  }
  return workingDays;
}

/**
 * 計算當月加班時數
 *
 * 加班時數 = 月總工時 - 基準工時（工作天數 x 8）
 * 如果結果 < 0 則為 0（尚未超過正常工時）
 */
export function calculateMonthlyOvertime(
  totalMonthlyHours: number,
  year: number,
  month: number,
): number {
  const workingDays = getWorkingDaysInMonth(year, month);
  const baseHours = workingDays * 8;
  const overtime = totalMonthlyHours - baseHours;
  return Math.max(0, overtime);
}

/**
 * 取得加班警示等級
 */
export function getOvertimeLevel(overtimeHours: number): OvertimeLevel {
  if (overtimeHours > OVERTIME_CONFIG.LIMIT) return "danger";
  if (overtimeHours >= OVERTIME_CONFIG.WARNING_THRESHOLD) return "warning";
  return "safe";
}

/**
 * 計算完整的加班資訊
 */
export function getOvertimeInfo(
  totalMonthlyHours: number,
  year: number,
  month: number,
): OvertimeInfo {
  const overtimeHours = calculateMonthlyOvertime(totalMonthlyHours, year, month);
  const level = getOvertimeLevel(overtimeHours);
  return {
    overtimeHours,
    level,
    limit: OVERTIME_CONFIG.LIMIT,
  };
}
