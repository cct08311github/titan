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

// ─── Issue #1321: Daily Personal Digest ───────────────────────────────────────

export interface DigestTaskItem {
  taskId: string;
  taskTitle: string;
  dueDate?: string; // formatted date string
}

export interface DigestItems {
  dueTodayTasks: DigestTaskItem[];
  newAssignments: DigestTaskItem[];
  unreadMentionCount: number;
  pendingApprovalCount: number; // MANAGER only; 0 for ENGINEER
}

export function dailyDigestEmail(
  userName: string,
  items: DigestItems,
  date: string
): { subject: string; html: string } {
  const safeName = escapeHtml(userName);
  const safeDate = escapeHtml(date);

  const dueTodayRows = items.dueTodayTasks
    .map(t => {
      const safeTitle = escapeHtml(t.taskTitle);
      const safeId = urlPart(t.taskId);
      return `<tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
          <a href="${BASE_URL}/kanban?taskId=${safeId}" style="color: #4f46e5; text-decoration: none;">${safeTitle}</a>
        </td>
        <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; color: #666; font-size: 13px; text-align: right;">${escapeHtml(t.dueDate ?? "")}</td>
      </tr>`;
    })
    .join("");

  const newAssignRows = items.newAssignments
    .map(t => {
      const safeTitle = escapeHtml(t.taskTitle);
      const safeId = urlPart(t.taskId);
      return `<tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
          <a href="${BASE_URL}/kanban?taskId=${safeId}" style="color: #4f46e5; text-decoration: none;">${safeTitle}</a>
        </td>
      </tr>`;
    })
    .join("");

  const dueTodaySection =
    items.dueTodayTasks.length > 0
      ? `<h3 style="color: #f59e0b; margin: 24px 0 8px; font-size: 15px;">今日到期任務（${items.dueTodayTasks.length} 筆）</h3>
         <table style="width: 100%; border-collapse: collapse;">${dueTodayRows}</table>`
      : "";

  const newAssignSection =
    items.newAssignments.length > 0
      ? `<h3 style="color: #4f46e5; margin: 24px 0 8px; font-size: 15px;">昨日新指派任務（${items.newAssignments.length} 筆）</h3>
         <table style="width: 100%; border-collapse: collapse;">${newAssignRows}</table>`
      : "";

  const mentionSection =
    items.unreadMentionCount > 0
      ? `<div style="background: #f0f4ff; border-left: 4px solid #6366f1; padding: 10px 14px; margin: 16px 0; border-radius: 4px;">
           <strong>${items.unreadMentionCount}</strong> 則未讀 @提及或留言，
           <a href="${BASE_URL}/activity" style="color: #4f46e5;">前往查看</a>
         </div>`
      : "";

  const approvalSection =
    items.pendingApprovalCount > 0
      ? `<div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 10px 14px; margin: 16px 0; border-radius: 4px;">
           <strong>${items.pendingApprovalCount}</strong> 筆申請待您審核，
           <a href="${BASE_URL}/kanban" style="color: #f97316;">前往審核</a>
         </div>`
      : "";

  return {
    subject: safeSubject(`[TITAN] ${safeDate} 每日摘要`),
    html: `${WRAPPER_START}
      <h2 style="color: #333; margin: 0 0 4px;">每日工作摘要</h2>
      <p style="color: #666; margin: 0 0 16px;">${safeName}，${safeDate}</p>
      ${dueTodaySection}
      ${newAssignSection}
      ${mentionSection}
      ${approvalSection}
      <div style="margin-top: 20px;">
        <a href="${BASE_URL}/dashboard" style="display: inline-block; background: #4f46e5; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none;">前往儀表板</a>
      </div>
    ${WRAPPER_END}`,
  };
}

// ─── Issue #1321: Weekly Manager Summary ─────────────────────────────────────

export interface KpiBehindItem {
  kpiCode: string;
  kpiTitle: string;
  actual: number;
  target: number;
  unit: string;
}

export interface NextWeekDueItem {
  taskId: string;
  taskTitle: string;
  dueDate: string;
  assigneeName: string;
}

export interface ManagerSummary {
  overdueCount: number;
  flaggedCount: number;
  weeklyCompletedCount: number;
  kpiBehindItems: KpiBehindItem[];
  nextWeekDueItems: NextWeekDueItem[];
  weekLabel: string; // e.g. "2026/04/07 ~ 04/11"
}

export function weeklyManagerEmail(
  userName: string,
  summary: ManagerSummary
): { subject: string; html: string } {
  const safeName = escapeHtml(userName);
  const safeWeek = escapeHtml(summary.weekLabel);

  const kpiBehindRows = summary.kpiBehindItems
    .map(k => {
      const pct = k.target > 0 ? Math.round((k.actual / k.target) * 100) : 0;
      return `<tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px;">${escapeHtml(k.kpiCode)}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">${escapeHtml(k.kpiTitle)}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; color: #dc2626; text-align: right;">${k.actual} / ${k.target} ${escapeHtml(k.unit ?? "")} (${pct}%)</td>
      </tr>`;
    })
    .join("");

  const nextWeekRows = summary.nextWeekDueItems
    .map(t => {
      const safeId = urlPart(t.taskId);
      return `<tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
          <a href="${BASE_URL}/kanban?taskId=${safeId}" style="color: #4f46e5; text-decoration: none;">${escapeHtml(t.taskTitle)}</a>
        </td>
        <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; color: #666; font-size: 13px;">${escapeHtml(t.assigneeName)}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0; color: #666; font-size: 13px; text-align: right;">${escapeHtml(t.dueDate)}</td>
      </tr>`;
    })
    .join("");

  const healthBlock = `
    <div style="display: flex; gap: 16px; margin: 16px 0;">
      <div style="flex: 1; background: #fef2f2; border-radius: 8px; padding: 14px 16px; text-align: center;">
        <div style="font-size: 28px; font-weight: bold; color: #dc2626;">${summary.overdueCount}</div>
        <div style="color: #666; font-size: 13px; margin-top: 4px;">逾期任務</div>
      </div>
      <div style="flex: 1; background: #fff7ed; border-radius: 8px; padding: 14px 16px; text-align: center;">
        <div style="font-size: 28px; font-weight: bold; color: #f97316;">${summary.flaggedCount}</div>
        <div style="color: #666; font-size: 13px; margin-top: 4px;">主管標記</div>
      </div>
      <div style="flex: 1; background: #f0fdf4; border-radius: 8px; padding: 14px 16px; text-align: center;">
        <div style="font-size: 28px; font-weight: bold; color: #16a34a;">${summary.weeklyCompletedCount}</div>
        <div style="color: #666; font-size: 13px; margin-top: 4px;">本週完成</div>
      </div>
    </div>`;

  const kpiBehindSection =
    summary.kpiBehindItems.length > 0
      ? `<h3 style="color: #dc2626; margin: 24px 0 8px; font-size: 15px;">落後 KPI 項目（${summary.kpiBehindItems.length} 項）</h3>
         <table style="width: 100%; border-collapse: collapse;">
           <thead>
             <tr style="color: #999; font-size: 12px; text-align: left;">
               <th style="padding: 4px 0; font-weight: normal;">代碼</th>
               <th style="padding: 4px 0; font-weight: normal;">名稱</th>
               <th style="padding: 4px 0; font-weight: normal; text-align: right;">實績 / 目標</th>
             </tr>
           </thead>
           <tbody>${kpiBehindRows}</tbody>
         </table>`
      : `<p style="color: #16a34a; margin: 16px 0;">✓ 本週無落後 KPI 項目</p>`;

  const nextWeekSection =
    summary.nextWeekDueItems.length > 0
      ? `<h3 style="color: #4f46e5; margin: 24px 0 8px; font-size: 15px;">下週到期任務（${summary.nextWeekDueItems.length} 筆）</h3>
         <table style="width: 100%; border-collapse: collapse;">
           <thead>
             <tr style="color: #999; font-size: 12px; text-align: left;">
               <th style="padding: 4px 0; font-weight: normal;">任務</th>
               <th style="padding: 4px 0; font-weight: normal;">負責人</th>
               <th style="padding: 4px 0; font-weight: normal; text-align: right;">到期日</th>
             </tr>
           </thead>
           <tbody>${nextWeekRows}</tbody>
         </table>`
      : "";

  return {
    subject: safeSubject(`[TITAN] ${safeWeek} 週報摘要`),
    html: `${WRAPPER_START}
      <h2 style="color: #333; margin: 0 0 4px;">每週主管摘要</h2>
      <p style="color: #666; margin: 0 0 16px;">${safeName}，${safeWeek}</p>
      <h3 style="color: #333; margin: 16px 0 8px; font-size: 15px;">團隊健康狀況</h3>
      ${healthBlock}
      ${kpiBehindSection}
      ${nextWeekSection}
      <div style="margin-top: 20px;">
        <a href="${BASE_URL}/dashboard" style="display: inline-block; background: #4f46e5; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none;">前往儀表板</a>
      </div>
    ${WRAPPER_END}`,
  };
}
