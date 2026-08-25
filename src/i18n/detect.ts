// Browser locale detection. Maps navigator.language (e.g. 'en-US', 'zh-TW',
// 'ja-JP') to one of our SUPPORTED_LOCALES.

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from './types';

/**
 * Resolve a BCP-47 language tag to a supported locale.
 * - Exact match wins (e.g. 'zh-CN' → 'zh-CN').
 * - Otherwise match by primary subtag (e.g. 'en-GB' → 'en', 'ja' → fallback
 *   default since we don't yet support 'ja').
 * - Unknown or empty language falls back to DEFAULT_LOCALE.
 */
export function resolveLocaleFromLanguage(language: string | undefined): Locale {
  if (!language) return DEFAULT_LOCALE;
  const normalized = language.trim().toLowerCase().replace(/_/g, '-');
  if (!normalized) return DEFAULT_LOCALE;
  if ((SUPPORTED_LOCALES as readonly string[]).includes(normalized)) {
    return normalized as Locale;
  }
  const primary = normalized.split('-')[0];
  if (primary === 'zh') {
    // All Chinese variants collapse to zh-CN until we add zh-TW support.
    return 'zh-CN';
  }
  if (primary === 'en') return 'en';
  return DEFAULT_LOCALE;
}

/**
 * Read the browser language. Safe to call in both browser and service
 * worker contexts; returns the default locale when navigator is missing.
 */
export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  return resolveLocaleFromLanguage(navigator.language);
}
