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

import { detectBrowserLocale, resolveLocaleFromLanguage } from './detect';
import {
  DEFAULT_LOCALE,
  type InterpolationParams,
  type LanguagePreference,
  type Locale,
  type MessageDict,
  missingKeyFallback,
  SUPPORTED_LOCALES,
} from './types';

import { MESSAGES_EN } from './messages/en';
import { MESSAGES_ZH_CN } from './messages/zh-CN';

const CATALOGS: Record<Locale, MessageDict> = {
  'zh-CN': MESSAGES_ZH_CN,
  en: MESSAGES_EN,
};

let currentLocale: Locale = DEFAULT_LOCALE;
let userPreference: LanguagePreference = 'auto';

export function setLanguagePreference(pref: LanguagePreference): void {
  userPreference = pref;
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function getUserLanguagePreference(): LanguagePreference {
  return userPreference;
}

export function resolveActiveLocale(): Locale {
  if (userPreference !== 'auto') return userPreference;
  return detectBrowserLocale();
}

/**
 * Apply a complete locale resolution. Call once at the entry points
 * (Options App mount, Popup mount, translator install) to keep the
 * module-level `currentLocale` in sync with persisted preference.
 */
export function applyLocale(locale: Locale, preference: LanguagePreference): void {
  currentLocale = locale;
  userPreference = preference;
}

/**
 * Localize `key`. Optionally accepts an explicit `locale` to override the
 * current locale (useful in tests and for one-off log messages).
 */
export function t(
  key: string,
  params?: InterpolationParams,
  locale: Locale = currentLocale,
): string {
  const raw = CATALOGS[locale]?.[key]
    ?? CATALOGS[DEFAULT_LOCALE]?.[key]
    ?? missingKeyFallback(key, locale);
  return interpolate(raw, params);
}

function interpolate(template: string, params?: InterpolationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export type { Locale, LanguagePreference, InterpolationParams, MessageDict } from './types';
export { DEFAULT_LOCALE, SUPPORTED_LOCALES, missingKeyFallback } from './types';
export { resolveLocaleFromLanguage, detectBrowserLocale } from './detect';
