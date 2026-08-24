import { describe, expect, it } from 'vitest';
import { DEFAULT_SELECTION_QUICK_ACTION, PROVIDER_PRESETS } from '@/src/core/defaults';

describe('provider presets', () => {
  it('keeps the in-page selection shortcut disabled by default', () => {
    expect(DEFAULT_SELECTION_QUICK_ACTION).toBe(false);
  });

  it('offers an explicit Alibaba Cloud Qwen preset through the compatible protocol', () => {
    expect(PROVIDER_PRESETS).toContainEqual({
      id: 'qwen',
      label: '阿里云百炼 Qwen',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      modelPlaceholder: '例如：qwen-plus',
    });
  });
});
