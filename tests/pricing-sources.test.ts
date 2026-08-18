import { describe, expect, it } from 'vitest';
import { getOfficialPricingSource } from '@/src/core/pricing-sources';

describe('official pricing sources', () => {
  it.each([
    ['https://api.openai.com/v1', 'openai'],
    ['https://dashscope.aliyuncs.com/compatible-mode/v1', 'qwen'],
    ['https://dashscope-intl.aliyuncs.com/compatible-mode/v1', 'qwen'],
    ['https://api.deepseek.com', 'deepseek'],
    ['https://openrouter.ai/api/v1', 'openrouter'],
    ['https://api.siliconflow.cn/v1', 'siliconflow'],
  ])('matches %s to %s', (baseUrl, expectedId) => {
    expect(getOfficialPricingSource(baseUrl)?.id).toBe(expectedId);
  });

  it('does not match lookalike hosts, HTTP endpoints, or invalid URLs', () => {
    expect(getOfficialPricingSource('https://api.openai.com.example.org/v1')).toBeNull();
    expect(getOfficialPricingSource('http://api.openai.com/v1')).toBeNull();
    expect(getOfficialPricingSource('not a URL')).toBeNull();
  });

  it('returns metadata without internal matching fields', () => {
    const source = getOfficialPricingSource(
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
    );

    expect(source).toMatchObject({
      providerLabel: '阿里云百炼 Qwen',
      checkedAt: '2026-08-17',
    });
    expect(source).not.toHaveProperty('hostnames');
  });
});
