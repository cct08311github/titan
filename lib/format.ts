/**
 * Shared date/time formatting utilities.
 * Locale: zh-TW throughout for consistency.
 */

const LOCALE = "zh-TW";

/** Format as date only, e.g. "2024/03/25" */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString(LOCALE);
}

/** Format as date + time, e.g. "2024/3/25 下午2:30:00" */
export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString(LOCALE);
}

/** Format as short date + time (MM/DD HH:mm), e.g. "03/25 14:30" */
export function formatShortDateTime(date: string | Date): string {
  return new Date(date).toLocaleDateString(LOCALE, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format relative time description, e.g. "3 天前" */
export function formatRelative(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "剛剛";
  if (diffMin < 60) return `${diffMin} 分鐘前`;
  if (diffHour < 24) return `${diffHour} 小時前`;
  if (diffDay < 30) return `${diffDay} 天前`;
  return formatDate(date);
}
