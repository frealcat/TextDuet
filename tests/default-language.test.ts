import { describe, expect, it } from 'vitest';
import { resolveSystemLanguage, resolveTargetLanguage } from '@/src/core/defaults';

describe('language preferences', () => {
  it('maps locale families and Chinese regional variants', () => {
    expect(resolveSystemLanguage('en-US')).toBe('en');
    expect(resolveSystemLanguage('zh-HK')).toBe('zh-TW');
    expect(resolveSystemLanguage('zh-SG')).toBe('zh-CN');
    expect(resolveSystemLanguage('pt-BR')).toBe('en');
  });

  it('resolves the system sentinel while preserving explicit languages', () => {
    expect(resolveTargetLanguage('system')).toBe(resolveSystemLanguage());
    expect(resolveTargetLanguage('ja')).toBe('ja');
  });
});
