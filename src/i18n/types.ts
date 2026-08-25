// Locale and message types for TextDuet i18n.

export type Locale = 'zh-CN' | 'en';
export const SUPPORTED_LOCALES: readonly Locale[] = ['zh-CN', 'en'] as const;
export const DEFAULT_LOCALE: Locale = 'zh-CN';

/** User-selected language; 'auto' means "follow browser locale". */
export type LanguagePreference = 'auto' | Locale;

export type MessageDict = Record<string, string>;

export type InterpolationParams = Record<string, string | number>;

/**
 * Default fallback when a key is missing from BOTH locale dictionaries.
 * Returning the key itself keeps the extension usable; we also log a
 * console.warn so the gap is visible during development.
 */
export function missingKeyFallback(key: string, locale: Locale): string {
  // Use console.warn so dev tools surface the gap without breaking the UI.
  // The lint warning is acceptable: missing key is a developer-facing issue.
  // eslint-disable-next-line no-console
  console.warn(`[i18n] missing key "${key}" in locale "${locale}"`);
  return key;
}
