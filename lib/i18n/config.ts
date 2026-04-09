/**
 * i18n configuration — Issue #408
 *
 * Central configuration for internationalization.
 * Used by next-intl when installed (Phase 2).
 */

/** Supported locales */
// NOTE: English support pending future release
export const locales = ["zh-TW"] as const;

/** Default locale — Traditional Chinese for banking environment */
export const defaultLocale = "zh-TW" as const;

/** Locale display names */
export const localeNames: Record<(typeof locales)[number], string> = {
  "zh-TW": "繁體中文",
};

export type Locale = (typeof locales)[number];
