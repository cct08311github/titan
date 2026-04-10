/**
 * Email templates — Issue #864
 *
 * Simple HTML templates for notification emails.
 * Uses inline styles for maximum email client compatibility.
 *
 * SECURITY: All user-controlled fields (task titles, etc.) MUST be passed
 * through escapeHtml() before interpolation. The DB-side markdown sanitizer
 * permits some HTML for the in-app rendering path; emails MUST NOT inherit
 * that, since attacker-controlled HTML in mail clients = stored XSS / phish.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BASE_URL ?? "http://localhost:3000";

/** Strict HTML escape for email body interpolation (prevents stored XSS via task titles). */
function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Strip control characters from a value used in Subject header (prevents header injection). */
function safeSubject(value: string): string {
  return String(value).replace(/[\r\n\t\v\f\0]/g, " ").slice(0, 200);
}

/** Encode a value for use inside a URL component (prevents URL break-out). */
function urlPart(value: string): string {
  return encodeURIComponent(String(value));
}

const WRAPPER_START = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,.1);">
`;

const WRAPPER_END = `
<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
<p style="color: #999; font-size: 12px;">此郵件由 TITAN 系統自動發送，請勿直接回覆。</p>
</div>
</body>
</html>
`;

export function taskAssignedEmail(taskTitle: string, taskId: string): { subject: string; html: string } {
  const safeTitle = escapeHtml(taskTitle);
  const safeId = urlPart(taskId);
  return {
    subject: safeSubject(`[TITAN] 您被指派了新任務：${taskTitle}`),
    html: `${WRAPPER_START}
      <h2 style="color: #333; margin: 0 0 16px;">任務指派通知</h2>
      <p>您被指派了一項新任務：</p>
      <div style="background: #f0f4ff; border-left: 4px solid #4f46e5; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <strong>${safeTitle}</strong>
      </div>
      <a href="${BASE_URL}/kanban?taskId=${safeId}" style="display: inline-block; background: #4f46e5; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-top: 12px;">查看任務</a>
    ${WRAPPER_END}`,
  };
}

export function dueSoonEmail(taskTitle: string, taskId: string, dueDate: string): { subject: string; html: string } {
  const safeTitle = escapeHtml(taskTitle);
  const safeId = urlPart(taskId);
  const safeDate = escapeHtml(dueDate);
  return {
    subject: safeSubject(`[TITAN] 任務即將到期：${taskTitle}`),
    html: `${WRAPPER_START}
      <h2 style="color: #333; margin: 0 0 16px;">到期提醒</h2>
      <p>以下任務即將到期，請及時處理：</p>
      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <strong>${safeTitle}</strong><br/>
        <span style="color: #92400e;">到期日：${safeDate}</span>
      </div>
      <a href="${BASE_URL}/kanban?taskId=${safeId}" style="display: inline-block; background: #f59e0b; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-top: 12px;">查看任務</a>
    ${WRAPPER_END}`,
  };
}

export function overdueEmail(taskTitle: string, taskId: string, overdueDays: number): { subject: string; html: string } {
  const safeTitle = escapeHtml(taskTitle);
  const safeId = urlPart(taskId);
  return {
    subject: safeSubject(`[TITAN] 任務已逾期：${taskTitle}（逾期 ${overdueDays} 天）`),
    html: `${WRAPPER_START}
      <h2 style="color: #dc2626; margin: 0 0 16px;">逾期通知</h2>
      <p>以下任務已逾期，請儘速處理：</p>
      <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <strong>${safeTitle}</strong><br/>
        <span style="color: #991b1b;">已逾期 ${overdueDays} 天</span>
      </div>
      <a href="${BASE_URL}/kanban?taskId=${safeId}" style="display: inline-block; background: #dc2626; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-top: 12px;">查看任務</a>
    ${WRAPPER_END}`,
  };
}

export function slaAlertEmail(taskTitle: string, taskId: string, timeLeft: string): { subject: string; html: string } {
  const safeTitle = escapeHtml(taskTitle);
  const safeId = urlPart(taskId);
  const safeTime = escapeHtml(timeLeft);
  return {
    subject: safeSubject(`⚠️ [TITAN] SLA 即將到期：${taskTitle}（剩餘 ${timeLeft}）`),
    html: `${WRAPPER_START}
      <h2 style="color: #dc2626; margin: 0 0 16px;">⚠️ SLA 告警</h2>
      <p style="font-size: 16px;">以下任務的 SLA 即將到期：</p>
      <div style="background: #fef2f2; border: 2px solid #dc2626; padding: 16px; margin: 16px 0; border-radius: 8px;">
        <strong style="font-size: 18px;">${safeTitle}</strong><br/>
        <span style="color: #dc2626; font-size: 24px; font-weight: bold;">剩餘 ${safeTime}</span>
      </div>
      <a href="${BASE_URL}/kanban?taskId=${safeId}" style="display: inline-block; background: #dc2626; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 12px; font-size: 16px;">立即處理</a>
    ${WRAPPER_END}`,
  };
}

export function timesheetReminderEmail(currentHours: number, targetHours: number): { subject: string; html: string } {
  return {
    subject: `[TITAN] 本週工時尚未填滿：目前 ${currentHours}/${targetHours} 小時`,
    html: `${WRAPPER_START}
      <h2 style="color: #333; margin: 0 0 16px;">工時填報提醒</h2>
      <p>您本週的工時尚未填滿：</p>
      <div style="background: #f0f4ff; border-left: 4px solid #4f46e5; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <span style="font-size: 20px; font-weight: bold;">${currentHours} / ${targetHours} 小時</span>
      </div>
      <p>請於下班前完成填報。</p>
      <a href="${BASE_URL}/timesheet" style="display: inline-block; background: #4f46e5; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-top: 12px;">前往工時表</a>
    ${WRAPPER_END}`,
  };
}
