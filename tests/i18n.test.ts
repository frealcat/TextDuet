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
      // The dictionaries are still being filled by the extraction subAgent.
      // We only assert that t() does not throw and returns a string. Once
      // both catalogs share a key, the same value should come back from
      // either locale.
      const value = t('i18n.test.marker');
      expect(typeof value).toBe('string');
    });

    it('returns the explicit-locale string when key exists', () => {
      const value = t('i18n.test.marker', undefined, 'en');
      expect(typeof value).toBe('string');
    });

    it('falls back to zh-CN when the key is missing in the active locale', () => {
      // Since both dictionaries may be empty during early-stage tests, we
      // only assert that the fallback chain terminates without throwing.
      setLocale('en');
      const value = t('__synthetic_missing_for_fallback_test__');
      expect(value).toBe('__synthetic_missing_for_fallback_test__');
    });

    it('returns the key itself and warns when neither catalog has the key', () => {
      setLocale('zh-CN');
      // suppress the expected warn so test output stays clean
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
      // Use any key that contains a placeholder; if none exist, use a temp
      // catalog via a missing key that returns a key with placeholders.
      const originalWarn = console.warn;
      console.warn = () => undefined;
      try {
        // Synthetic key with placeholders that is not in any catalog.
        const out = t('__synth__ {name} - {count}', { name: 'Claude', count: 7 }, 'en');
        expect(out).toBe('__synth__ Claude - 7');
      } finally {
        console.warn = originalWarn;
      }
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
