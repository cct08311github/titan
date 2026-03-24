/**
 * Structured JSON logger using pino.
 * Issue #82: Structured logging with pino
 *
 * Levels: debug, info, warn, error
 * Context: timestamp (time), level, message (msg), plus any extra fields
 * Sensitive fields are masked via sanitizeData()
 */
import pino from "pino";

/** Re-export the pino Logger type for use in tests and other modules. */
export type Logger = pino.Logger;

/** Keys that must never appear in plain text in log output. */
const SENSITIVE_KEYS = new Set([
  "password",
  "passwd",
  "secret",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "cookie",
  "apiKey",
  "api_key",
  "privateKey",
  "private_key",
  "creditCard",
  "cvv",
]);

/**
 * Recursively masks sensitive fields in a plain object.
 * Returns a new object — never mutates the input.
 */
export function sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key)) {
      result[key] = "[REDACTED]";
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeData(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Singleton pino logger instance. */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // pino writes to stdout by default; timestamp is included as `time` (epoch ms)
  timestamp: pino.stdTimeFunctions.epochTime,
  // Serialize Error objects with type, message, and stack
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
});

/**
 * Create a child logger bound to a request ID (Issue #199).
 * Usage: const log = withRequestId(headers().get('x-request-id'));
 */
export function withRequestId(requestId: string | null): pino.Logger {
  return requestId ? logger.child({ requestId }) : logger;
}
