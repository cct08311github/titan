/**
 * Push Notification Service — Stub Implementation
 *
 * Issue #379: 行信 API 推播通知進度追蹤
 *
 * v1.0: Stub that logs push requests. No actual external API call.
 * v2.0: Integrate with bank's internal messaging API (行信系統).
 *
 * Design notes:
 * - Interface defined for future provider swapping
 * - Stub logs to server console for development visibility
 * - All methods return predictable results for testing
 */

import { logger } from "@/lib/logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PushRecipient {
  userId: string;
  /** Bank internal messaging ID (行信帳號), required for production */
  externalId?: string;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Optional deep link path within TITAN (e.g., "/tasks/abc123") */
  link?: string;
  /** Priority: normal or high (high = immediate delivery) */
  priority?: "normal" | "high";
}

export interface PushResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface PushNotificationProvider {
  /** Send a push notification to one or more recipients */
  send(recipients: PushRecipient[], message: PushMessage): Promise<PushResult>;
  /** Check if the provider is available and configured */
  isAvailable(): boolean;
}

// ─── Stub Implementation ─────────────────────────────────────────────────────

/**
 * Stub provider that logs push notifications without sending them.
 * Replace with BankPushProvider in v2.0 when 行信 API credentials are available.
 */
export class StubPushProvider implements PushNotificationProvider {
  send(recipients: PushRecipient[], message: PushMessage): Promise<PushResult> {
    logger.info("[PushNotification] Stub send", {
      recipientCount: recipients.length,
      recipientIds: recipients.map((r) => r.userId),
      title: message.title,
      priority: message.priority ?? "normal",
    });

    return Promise.resolve({
      success: true,
      messageId: `stub-${Date.now()}`,
    });
  }

  isAvailable(): boolean {
    return false; // Stub is never "production-ready"
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let _provider: PushNotificationProvider | null = null;

export function getPushProvider(): PushNotificationProvider {
  if (!_provider) {
    _provider = new StubPushProvider();
  }
  return _provider;
}

/**
 * Allow injecting a real provider (e.g., in integration tests or production).
 */
export function setPushProvider(provider: PushNotificationProvider): void {
  _provider = provider;
}
