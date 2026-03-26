/**
 * SLA countdown utilities — Issue #860
 */

export type SlaStatus = "safe" | "warning" | "danger" | "expired";

/**
 * Calculate remaining milliseconds until slaDeadline.
 * Returns negative values when expired.
 */
export function slaRemainingMs(slaDeadline: Date | string, now?: Date): number {
  const deadline = typeof slaDeadline === "string" ? new Date(slaDeadline) : slaDeadline;
  const ref = now ?? new Date();
  return deadline.getTime() - ref.getTime();
}

/**
 * Format remaining time as HH:MM:SS or "X 天 HH:MM:SS" for > 24h.
 */
export function formatSlaCountdown(remainingMs: number): string {
  if (remainingMs <= 0) {
    const overMs = Math.abs(remainingMs);
    const overMins = Math.ceil(overMs / 60000);
    return `已逾期 ${overMins} 分鐘`;
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (days > 0) {
    return `${days} 天 ${hh}:${mm}:${ss}`;
  }
  return `${hh}:${mm}:${ss}`;
}

/**
 * Determine SLA color status based on remaining percentage.
 * @param totalMs total SLA duration in ms (from creation to deadline)
 * @param remainingMs remaining ms
 */
export function getSlaStatus(remainingMs: number, totalMs?: number): SlaStatus {
  if (remainingMs <= 0) return "expired";

  if (totalMs && totalMs > 0) {
    const pct = remainingMs / totalMs;
    if (pct > 0.5) return "safe";
    if (pct > 0.25) return "warning";
    return "danger";
  }

  // Fallback: use absolute thresholds
  const twoHours = 2 * 60 * 60 * 1000;
  if (remainingMs > twoHours) return "safe";
  const thirtyMin = 30 * 60 * 1000;
  if (remainingMs > thirtyMin) return "warning";
  return "danger";
}

/**
 * Get CSS color class for SLA status.
 */
export function getSlaColorClass(status: SlaStatus): string {
  switch (status) {
    case "safe": return "text-green-600";
    case "warning": return "text-yellow-600";
    case "danger": return "text-red-600";
    case "expired": return "text-red-600 animate-pulse";
  }
}

/**
 * Get badge CSS for SLA status.
 */
export function getSlaBadgeClass(status: SlaStatus): string {
  switch (status) {
    case "safe": return "bg-green-100 text-green-700";
    case "warning": return "bg-yellow-100 text-yellow-700";
    case "danger": return "bg-red-100 text-red-700";
    case "expired": return "bg-red-600 text-white";
  }
}
