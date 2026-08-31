/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { extractI18nTranslations } from '@/src/i18n/response';

describe('i18n Provider response extraction', () => {
  it('keeps only requested non-empty keys', () => {
    const result = extractI18nTranslations(
      JSON.stringify({ first: '一', empty: '', extra: '忽略' }),
      ['first', 'empty'],
    );
    expect(result).toEqual({ first: '一' });
  });

  it('accepts a fenced JSON response', () => {
    expect(extractI18nTranslations('```json\n{"title":"标题"}\n```', ['title']))
      .toEqual({ title: '标题' });
  });

  it('bounds key count, value length, and aggregate output size', () => {
    const manyKeys = Object.fromEntries(
      Array.from({ length: 51 }, (_, index) => [`k${index}`, 'v']),
    );
    const manyResult = extractI18nTranslations(
      JSON.stringify(manyKeys),
      Object.keys(manyKeys),
    );
    expect(Object.keys(manyResult)).toHaveLength(50);

    const oversized = extractI18nTranslations(
      JSON.stringify({ huge: 'x'.repeat(16_001), okay: 'ok' }),
      ['huge', 'okay'],
    );
    expect(oversized).toEqual({ okay: 'ok' });

    const aggregate = extractI18nTranslations(
      JSON.stringify({
        first: 'x'.repeat(16_000),
        second: 'y'.repeat(16_000),
        third: 'z'.repeat(16_000),
        fourth: 'w'.repeat(16_000),
      }),
      ['first', 'second', 'third', 'fourth'],
    );
    expect(Object.keys(aggregate)).toEqual(['first', 'second', 'third']);
  });

  it('uses a null-prototype result and ignores prototype mutation keys', () => {
    const result = extractI18nTranslations(
      '{"__proto__":"polluted","constructor":"bad","safe":"ok"}',
      ['__proto__', 'constructor', 'safe'],
    );
    expect(Object.getPrototypeOf(result)).toBeNull();
    expect(result).toEqual({ safe: 'ok' });
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
  });

  it('surfaces malformed JSON for the caller to report', () => {
    expect(() => extractI18nTranslations('{not-json}', ['title'])).toThrow();
  });
});
