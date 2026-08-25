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

const CATALOGS: Record<Locale, MessageDict> = {
  'zh-CN': MESSAGES_ZH_CN,
  en: MESSAGES_EN,
};

export function setLanguagePreference(pref: LanguagePreference): void {
  setPreferenceOnly(pref);
}

export function setLocale(locale: Locale): void {
  setLocaleOnly(locale);
}

export function getLocale(): Locale {
  return getCurrentLocale();
}

export function getUserLanguagePreference(): LanguagePreference {
  return getCurrentPreference();
}

export function resolveActiveLocale(): Locale {
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
export function applyLocale(locale: Locale, preference: LanguagePreference): void {
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
export function useTranslation(): { t: typeof t; locale: Locale } {
  const locale = useSyncExternalStore(
    subscribeToLocaleChanges,
    getCurrentLocale,
    getCurrentLocale,
  );
  return { t: (key, params) => t(key, params, locale), locale };
}

/**
 * Localize `key`. Optionally accepts an explicit `locale` to override the
 * current locale (useful in tests and for one-off log messages).
 */
export function t(
  key: string,
  params?: InterpolationParams,
  locale: Locale = getCurrentLocale(),
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
