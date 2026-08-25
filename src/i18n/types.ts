// Locale and message types for TextDuet i18n.

/** Locales that ship as built-in (fully tested, hand-curated) dictionaries. */
export type Locale = 'zh-CN' | 'en';
export const SUPPORTED_LOCALES: readonly Locale[] = ['zh-CN', 'en'] as const;
export const DEFAULT_LOCALE: Locale = 'zh-CN';

/**
 * Any IETF BCP-47 language tag the user can choose in the language
 * selector. Built-in tags are `Locale`; anything else is a "user
 * locale" — translated on demand via the configured Provider and
 * cached in `storage.local`.
 */
export type LocaleTag = Locale | (string & { readonly __brand: 'LocaleTag' });

/** User-selected language; 'auto' means "follow browser locale". */
export type LanguagePreference = 'auto' | LocaleTag;

export type MessageDict = Record<string, string>;

export type InterpolationParams = Record<string, string | number>;

/** Storage key for a user-translated dictionary; stable across restarts. */
export function userLocaleStorageKey(tag: string, promptVersion: string): string {
  return `textduet-user-locale-${tag}-${promptVersion}.json`;
}

/** Bump this when the i18n translation prompt changes; invalidates old cache. */
export const I18N_PROMPT_VERSION = 'v1';

/** Batch size for translating the dictionary in one Provider call. */
export const I18N_BATCH_SIZE = 30;

/**
 * Default fallback when a key is missing from BOTH locale dictionaries.
 * Returning the key itself keeps the extension usable; we also log a
 * console.warn so the gap is visible during development.
 */
export function missingKeyFallback(key: string, locale: string): string {
  // Use console.warn so dev tools surface the gap without breaking the UI.
  // The lint warning is acceptable: missing key is a developer-facing issue.
  // eslint-disable-next-line no-console
  console.warn(`[i18n] missing key "${key}" in locale "${locale}"`);
  return key;
}
