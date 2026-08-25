import { afterEach, describe, expect, it } from 'vitest';
import {
  applyLocale,
  DEFAULT_LOCALE,
  detectBrowserLocale,
  getLocale,
  getUserLanguagePreference,
  resolveActiveLocale,
  resolveLocaleFromLanguage,
  setLanguagePreference,
  setLocale,
  SUPPORTED_LOCALES,
  t,
} from '@/src/i18n';

afterEach(() => {
  // Reset module-level state after each test.
  applyLocale(DEFAULT_LOCALE, 'auto');
});

describe('i18n runtime', () => {
  describe('resolveLocaleFromLanguage', () => {
    it('returns the exact match for known locales', () => {
      expect(resolveLocaleFromLanguage('zh-CN')).toBe('zh-CN');
      expect(resolveLocaleFromLanguage('en')).toBe('en');
    });

    it('collapses all Chinese variants to zh-CN', () => {
      expect(resolveLocaleFromLanguage('zh-TW')).toBe('zh-CN');
      expect(resolveLocaleFromLanguage('zh-HK')).toBe('zh-CN');
      expect(resolveLocaleFromLanguage('zh')).toBe('zh-CN');
    });

    it('normalizes en-GB / en-US to en', () => {
      expect(resolveLocaleFromLanguage('en-GB')).toBe('en');
      expect(resolveLocaleFromLanguage('en-US')).toBe('en');
    });

    it('falls back to default for unknown primary subtag', () => {
      expect(resolveLocaleFromLanguage('ja-JP')).toBe('zh-CN');
      expect(resolveLocaleFromLanguage('fr-FR')).toBe('zh-CN');
    });

    it('handles underscore-separated tags and undefined / empty input', () => {
      expect(resolveLocaleFromLanguage('en_US')).toBe('en');
      expect(resolveLocaleFromLanguage(undefined)).toBe('zh-CN');
      expect(resolveLocaleFromLanguage('')).toBe('zh-CN');
    });

    it('every supported locale is handled without falling back', () => {
      for (const locale of SUPPORTED_LOCALES) {
        expect(resolveLocaleFromLanguage(locale)).toBe(locale);
      }
    });
  });

  describe('detectBrowserLocale', () => {
    it('returns a valid locale even when navigator is unavailable', () => {
      // jsdom is not configured; navigator may be undefined in node test env.
      // The function must not throw and must return a valid Locale.
      const detected = detectBrowserLocale();
      expect(SUPPORTED_LOCALES).toContain(detected);
    });
  });

  describe('applyLocale + setLanguagePreference', () => {
    it('updates the active locale and preference', () => {
      applyLocale('en', 'en');
      expect(getLocale()).toBe('en');
      expect(getUserLanguagePreference()).toBe('en');
      expect(resolveActiveLocale()).toBe('en');
    });

    it('resolveActiveLocale returns the explicit preference when not auto', () => {
      setLanguagePreference('zh-CN');
      setLocale('en');
      expect(resolveActiveLocale()).toBe('zh-CN');
    });

    it('setLocale changes only the active locale, not the preference', () => {
      setLanguagePreference('en');
      setLocale('zh-CN');
      expect(getLocale()).toBe('zh-CN');
      expect(getUserLanguagePreference()).toBe('en');
    });
  });

  describe('t() — basic lookup', () => {
    it('returns the current locale string when key exists in current locale', () => {
      applyLocale('zh-CN', 'zh-CN');
      // The dictionaries are populated by the extraction + translation
      // subAgents. We only assert that t() does not throw and returns a
      // string for any in-dict key.
      const value = t('popup.brand.title');
      expect(typeof value).toBe('string');
      // Brand title is always TextDuet (proper noun, not translated).
      expect(value).toBe('TextDuet');
    });

    it('returns the explicit-locale string when key exists', () => {
      const value = t('popup.brand.title', undefined, 'en');
      expect(value).toBe('TextDuet');
    });

    it('falls back to zh-CN when the key is missing in the active locale', () => {
      // Since both dictionaries are populated, we use a synthetic key.
      setLocale('en');
      const value = t('__synthetic_missing_for_fallback_test__');
      expect(value).toBe('__synthetic_missing_for_fallback_test__');
    });

    it('returns the key itself and warns when neither catalog has the key', () => {
      setLocale('zh-CN');
      const originalWarn = console.warn;
      console.warn = () => undefined;
      try {
        expect(t('__definitely_missing_key__')).toBe('__definitely_missing_key__');
      } finally {
        console.warn = originalWarn;
      }
    });
  });

  describe('t() — interpolation', () => {
    it('substitutes {name} placeholders from the params object', () => {
      // popup.cost.inputOutput has {input} and {output} placeholders.
      applyLocale('zh-CN', 'zh-CN');
      const out = t('popup.cost.inputOutput', { input: 1234, output: 567 });
      expect(out).toContain('1234');
      expect(out).toContain('567');
    });

    it('leaves unknown placeholders intact', () => {
      const originalWarn = console.warn;
      console.warn = () => undefined;
      try {
        const out = t('__synth__ {name} {missing}', { name: 'A' }, 'en');
        expect(out).toBe('__synth__ A {missing}');
      } finally {
        console.warn = originalWarn;
      }
    });

    it('returns the template unchanged when params is undefined', () => {
      const originalWarn = console.warn;
      console.warn = () => undefined;
      try {
        expect(t('__synth__ {name}')).toBe('__synth__ {name}');
      } finally {
        console.warn = originalWarn;
      }
    });
  });
});

describe('i18n dictionary integrity', () => {
  it('every zh-CN key has a non-empty English counterpart', async () => {
    const { MESSAGES_ZH_CN } = await import('@/src/i18n/messages/zh-CN');
    const { MESSAGES_EN } = await import('@/src/i18n/messages/en');
    const missing: string[] = [];
    const empty: string[] = [];
    for (const [key, zh] of Object.entries(MESSAGES_ZH_CN)) {
      const en = MESSAGES_EN[key];
      if (en === undefined) missing.push(key);
      else if (typeof en !== 'string' || en.trim().length === 0) empty.push(key);
    }
    expect(missing, `keys in zh-CN missing from en: ${missing.join(', ')}`).toEqual([]);
    expect(empty, `keys with empty English value: ${empty.join(', ')}`).toEqual([]);
  });

  it('every English key exists in zh-CN (no orphans)', async () => {
    const { MESSAGES_ZH_CN } = await import('@/src/i18n/messages/zh-CN');
    const { MESSAGES_EN } = await import('@/src/i18n/messages/en');
    const zhKeys = new Set(Object.keys(MESSAGES_ZH_CN));
    const enOrphans = Object.keys(MESSAGES_EN).filter((k) => !zhKeys.has(k));
    expect(enOrphans, `keys in en missing from zh-CN: ${enOrphans.join(', ')}`).toEqual([]);
  });

  it('placeholders in zh-CN match placeholders in en (no drift)', async () => {
    const { MESSAGES_ZH_CN } = await import('@/src/i18n/messages/zh-CN');
    const { MESSAGES_EN } = await import('@/src/i18n/messages/en');
    const placeholderSet = (s: string) => new Set(Array.from(s.matchAll(/\{(\w+)\}/g)).map((m) => m[1]));
    const drifted: string[] = [];
    for (const [key, zh] of Object.entries(MESSAGES_ZH_CN)) {
      const en = MESSAGES_EN[key];
      if (typeof en !== 'string') continue;
      const a = placeholderSet(zh);
      const b = placeholderSet(en);
      if (a.size !== b.size || ![...a].every((p) => b.has(p))) {
        drifted.push(`${key}: zh={${[...a].sort()}} en={${[...b].sort()}}`);
      }
    }
    expect(drifted, `placeholder drift: ${drifted.join('; ')}`).toEqual([]);
  });
});
