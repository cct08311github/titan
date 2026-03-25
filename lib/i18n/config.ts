/**
 * i18n configuration — Issue #408
 *
 * Central configuration for internationalization.
 * Used by next-intl when installed (Phase 2).
 */

/** Supported locales */
export const locales = ["zh-TW", "en"] as const;

/** Default locale — Traditional Chinese for banking environment */
export const defaultLocale = "zh-TW" as const;

/** Locale display names (for language switcher UI) */
export const localeNames: Record<(typeof locales)[number], string> = {
  "zh-TW": "繁體中文",
  en: "English",
};

export type Locale = (typeof locales)[number];
