/**
 * Outline configuration — KB-1 (#840)
 *
 * All Outline settings are read from environment variables.
 * API token is never exposed to the frontend.
 */

export interface OutlineConfig {
  /** Outline server base URL (internal) */
  baseUrl: string;
  /** API token for authentication */
  apiToken: string;
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Whether Outline integration is enabled */
  enabled: boolean;
}

export function getOutlineConfig(): OutlineConfig {
  const baseUrl = process.env.OUTLINE_INTERNAL_URL ?? "";
  const apiToken = process.env.OUTLINE_API_TOKEN ?? "";

  return {
    baseUrl: baseUrl.replace(/\/$/, ""), // strip trailing slash
    apiToken,
    timeoutMs: parseInt(process.env.OUTLINE_TIMEOUT_MS ?? "5000", 10),
    maxRetries: parseInt(process.env.OUTLINE_MAX_RETRIES ?? "2", 10),
    enabled: Boolean(baseUrl && apiToken),
  };
}
