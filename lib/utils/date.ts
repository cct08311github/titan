/**
 * 本地時區日期工具
 *
 * 不要用 toISOString() — 它會轉 UTC，在 UTC+8 凌晨時段會偏移一天。
 * 例如 2026-03-24T00:30:00+08:00 → toISOString() 會回傳 "2026-03-23T16:30:00Z"
 * 取 split("T")[0] 後會得到 "2026-03-23"，比本地日期少一天。
 */

/**
 * 格式化為 YYYY-MM-DD（本地時區）
 */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
