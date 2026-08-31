/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { normalizeSelectionError } from '@/src/translator/selection-errors';

const translate = (key: string): string => ({
  'translator.selection.error.apiKey': 'API key required',
  'translator.selection.error.tooLong': 'Selection too long',
  'translator.selection.error.format': 'Invalid model format',
  'translator.selection.error.consent': 'Confirm privacy in Popup or Options',
  'translator.selection.error.generic': 'Selection failed',
}[key] || key);

describe('selection error normalization', () => {
  it('maps the consent boundary to an actionable localized message', () => {
    expect(normalizeSelectionError(
      new Error('首次发送网页文本前需要确认数据去向与模型费用'),
      translate,
    )).toBe('Confirm privacy in Popup or Options');
    expect(normalizeSelectionError(
      Object.assign(new Error('request blocked'), { name: 'TranslationConsentRequiredError' }),
      translate,
    )).toBe('Confirm privacy in Popup or Options');
  });

  it('keeps existing actionable mappings localized', () => {
    expect(normalizeSelectionError(new Error('please configure API key'), translate)).toBe('API key required');
    expect(normalizeSelectionError(new Error('模型返回格式无效'), translate)).toBe('Invalid model format');
    expect(normalizeSelectionError(new Error('provider unavailable'), translate)).toBe('Selection failed');
  });
});
