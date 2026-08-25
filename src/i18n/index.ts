// TextDuet i18n runtime.
//
// - `t(key, params?, locale?)` returns the localized string for `key`.
// - Locale resolution: explicit arg > user preference > browser locale >
//   default 'zh-CN'.
// - Missing key in the chosen locale falls back to 'zh-CN', then to the
//   key string with a console.warn. We never throw — the extension must
//   keep working even with incomplete translations.
// - Interpolation uses {name} placeholders, e.g. t('cost.daily', { percent: 80 }).
//   This is intentionally minimal; we do not pull in ICU MessageFormat
//   just for a translation plugin.
//
// The module-level `currentLocale` is the canonical source of truth.
// React components subscribe via `useTranslation()` (uses
// useSyncExternalStore) so a language change triggers a re-render of
// every Options / Popup surface that calls `t()`.

import { useSyncExternalStore } from 'react';

import { detectBrowserLocale, resolveLocaleFromLanguage } from './detect';
import {
  DEFAULT_LOCALE,
  type InterpolationParams,
  type LanguagePreference,
  type Locale,
  type LocaleTag,
  type MessageDict,
  missingKeyFallback,
  SUPPORTED_LOCALES,
} from './types';

import { MESSAGES_EN } from './messages/en';
import { MESSAGES_ZH_CN } from './messages/zh-CN';

import {
  getCurrentLocale,
  getCurrentPreference,
  setLocaleFields,
  setLocaleOnly,
  setPreferenceOnly,
  subscribeToLocaleChanges,
} from './locale-store';

import {
  clearUserLocale,
  getUserLocale,
  listUserLocales,
  setUserLocale,
} from './user-locales';

const BASE_CATALOGS: Record<Locale, MessageDict> = {
  'zh-CN': MESSAGES_ZH_CN,
  en: MESSAGES_EN,
};

export function setLanguagePreference(pref: LanguagePreference): void {
  setPreferenceOnly(pref);
}

export function setLocale(locale: LocaleTag): void {
  setLocaleOnly(locale);
}

export function getLocale(): LocaleTag {
  return getCurrentLocale();
}

export function getUserLanguagePreference(): LanguagePreference {
  return getCurrentPreference();
}

export function resolveActiveLocale(): LocaleTag {
  const pref = getCurrentPreference();
  if (pref !== 'auto') return pref;
  return detectBrowserLocale();
}

/**
 * Apply a complete locale resolution. Call once at the entry points
 * (Options App mount, Popup mount, translator install) and from the
 * LanguageSelector onChange handler so a user action takes effect
 * immediately. Re-renders all subscribers via `useTranslation`.
 */
export function applyLocale(locale: LocaleTag, preference: LanguagePreference): void {
  setLocaleFields(locale, preference);
}

// React 18+ only; Popup / Options / LanguageSelector are all on React 19.

/**
 * React hook that subscribes to locale changes. Returns the active
 * `t` function bound to the current locale. Components that call
 * `t()` will re-render automatically when the user changes language.
 *
 * Use this in Options / Popup render bodies; for plain call sites that
 * already re-render for other reasons (e.g. a click handler), calling
 * `t()` directly is fine.
 */
export function useTranslation(): { t: typeof t; locale: LocaleTag } {
  const locale = useSyncExternalStore(
    subscribeToLocaleChanges,
    getCurrentLocale,
    getCurrentLocale,
  );
  return { t: (key, params) => t(key, params, locale), locale };
}

/**
 * Localize `key`. Lookup order:
 *   1. user-downloaded locale (storage.local + memory cache)
 *   2. built-in catalog (zh-CN / en)
 *   3. zh-CN fallback
 *   4. the key itself + console.warn (so UI stays usable)
 */
export function t(
  key: string,
  params?: InterpolationParams,
  locale: LocaleTag = getCurrentLocale(),
): string {
  const raw = lookupCatalog(locale, key)
    ?? lookupCatalog(DEFAULT_LOCALE, key)
    ?? missingKeyFallback(key, locale);
  return interpolate(raw, params);
}

function lookupCatalog(locale: string, key: string): string | undefined {
  // User-downloaded locales win (so users can fix imperfect built-ins).
  const userDict = getUserLocale(locale);
  const fromUser = userDict?.[key];
  if (fromUser) return fromUser;
  // Built-in catalogs (only Locale values match this Record).
  if (isLocale(locale)) {
    return BASE_CATALOGS[locale]?.[key];
  }
  return undefined;
}

function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function interpolate(template: string, params?: InterpolationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export {
  clearAllUserLocales,
  clearUserLocale,
  getUserLocale,
  hasUserLocale,
  listUserLocales,
  loadAllUserLocales,
  resetUserLocaleCacheForTest,
  setStorageBackend,
  setUserLocale,
  type UserLocaleRecord,
} from './user-locales';

export { translateUiTo, type Fetcher, type TranslateProgress, type TranslateUiToOptions, type TranslateUiToResult } from './translate-dictionary';

export type { Locale, LocaleTag, LanguagePreference, InterpolationParams, MessageDict } from './types';
export { DEFAULT_LOCALE, SUPPORTED_LOCALES, missingKeyFallback } from './types';
export { resolveLocaleFromLanguage, detectBrowserLocale } from './detect';
