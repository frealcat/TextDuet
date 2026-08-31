/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

// The Translator Script runs in an untrusted webpage context. Keep this
// module deliberately independent from the user-locale persistence layer:
// it contains only built-in catalogs and page-local locale state.

import {
  getCurrentLocale,
  getCurrentPreference,
  setLocaleFields,
} from './locale-store';
import { detectBrowserLocale } from './detect';
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

export type { LanguagePreference, LocaleTag } from './types';

const BASE_CATALOGS: Record<Locale, MessageDict> = {
  'zh-CN': MESSAGES_ZH_CN,
  en: MESSAGES_EN,
};

export function applyLocale(locale: LocaleTag, preference: LanguagePreference): void {
  setLocaleFields(locale, preference);
}

export function resolveActiveLocale(): LocaleTag {
  const preference = getCurrentPreference();
  if (preference !== 'auto') return preference;
  return detectBrowserLocale();
}

/**
 * Localize a Translator status message using only the built-in catalogs.
 * User-downloaded dictionaries intentionally stay in the trusted extension
 * contexts and are not read from the webpage-facing script.
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
  if (!isLocale(locale)) return undefined;
  return BASE_CATALOGS[locale]?.[key];
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
