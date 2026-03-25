/**
 * Server-side i18n request config — Issue #408
 *
 * This file will be used by next-intl's getRequestConfig() when installed.
 * For now, it provides a utility to load messages for a given locale.
 */

import { defaultLocale, type Locale } from "./config";

/**
 * Load messages for the given locale.
 * Falls back to default locale if the requested locale file is missing.
 */
export async function loadMessages(
  locale: Locale = defaultLocale
): Promise<Record<string, unknown>> {
  try {
    const messages = await import(`../../messages/${locale}.json`);
    return messages.default ?? messages;
  } catch {
    // Fallback to default locale
    const fallback = await import(`../../messages/${defaultLocale}.json`);
    return fallback.default ?? fallback;
  }
}
