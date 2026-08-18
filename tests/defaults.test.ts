import { describe, expect, it } from 'vitest';
import { PROVIDER_PRESETS } from '@/src/core/defaults';

describe('provider presets', () => {
  it('offers an explicit Alibaba Cloud Qwen preset through the compatible protocol', () => {
    expect(PROVIDER_PRESETS).toContainEqual({
      id: 'qwen',
      label: '阿里云百炼 Qwen',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      modelPlaceholder: '例如：qwen-plus',
    });
  });
});
