/**
 * Email sending service — Issue #864
 *
 * Uses nodemailer for SMTP relay. Config via env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_FROM, SMTP_USER, SMTP_PASS
 *
 * Fire-and-forget with error logging. Never blocks main flow.
 */

import { logger } from "@/lib/logger";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email via SMTP.
 * Returns success/failure without throwing.
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "25", 10);
  const from = process.env.SMTP_FROM ?? "titan@localhost";

  if (!host) {
    logger.warn("[email] SMTP_HOST not configured, skipping email send");
    return { success: false, error: "SMTP_HOST not configured" };
  }

  try {
    // Dynamic import to avoid build errors when nodemailer is not installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = require("nodemailer") as {
      createTransport: (config: Record<string, unknown>) => {
        sendMail: (opts: Record<string, unknown>) => Promise<{ messageId: string }>;
      };
    };

    const transportConfig: Record<string, unknown> = {
      host,
      port,
      secure: port === 465,
      connectionTimeout: 10000,
    };

    // Add auth only if credentials are provided
    if (process.env.SMTP_USER) {
      transportConfig.auth = {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      };
    }

    const transporter = nodemailer.createTransport(transportConfig);

    const info = await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    logger.info({ to: options.to, subject: options.subject, messageId: info.messageId }, "[email] sent");
    return { success: true, messageId: info.messageId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ to: options.to, error: errorMessage }, "[email] failed");
    return { success: false, error: errorMessage };
  }
}
