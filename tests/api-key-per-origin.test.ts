import { describe, expect, it } from 'vitest';
import {
  switchBaseUrlWithModelCache,
  writeActiveModelToOriginCache,
  migrateProviderModelsToOriginCache,
  normalizeBaseUrlOrigin,
} from '@/src/storage/provider-models';
import type { ProviderSettings } from '@/src/core/contracts';

function makeSettings(overrides: Partial<ProviderSettings> = {}): ProviderSettings {
  return {
    provider: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o'],
    targetLanguage: 'en',
    displayMode: 'bilingual',
    customSystemPrompt: '',
    apiKeyPersistence: 'local',
    ...overrides,
  } as ProviderSettings;
}

describe('API key is isolated per origin (TD-2026-WS3 fix)', () => {
  it('switchBaseUrl parks the previous origin key and rehydrates the new one', () => {
    const a = makeSettings({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-openai-secret-1234',
    });
    const switched = switchBaseUrlWithModelCache(a, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
    // Parked: the OpenAI key should be on the openai origin only.
    const openaiKey = normalizeBaseUrlOrigin(a.baseUrl);
    expect(openaiKey).toBe('https://api.openai.com');
    // Rehydrated: the new baseUrl's origin is dashscope. The active
    // apiKey should be empty (no prior key for that origin).
    expect(switched.apiKey).toBe('');
    // The OpenAI key must be in apiKeyByOrigin['https://api.openai.com'].
    const openaiStored = (switched.apiKeyByOrigin ?? {})[openaiKey!];
    expect(openaiStored).toBe('sk-openai-secret-1234');
    // Switching back to OpenAI should rehydrate the original key.
    const back = switchBaseUrlWithModelCache(switched, 'https://api.openai.com/v1');
    expect(back.apiKey).toBe('sk-openai-secret-1234');
  });

  it('writeActiveModelToOriginCache also writes the apiKey when supplied', () => {
    const a = makeSettings({
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKeyByOrigin: { 'https://api.openai.com': 'sk-openai' },
    });
    const b = writeActiveModelToOriginCache(a, { apiKey: 'sk-dashscope-5678' });
    expect(b.apiKey).toBe('sk-dashscope-5678');
    expect(b.apiKeyByOrigin).toEqual({
      'https://api.openai.com': 'sk-openai',
      'https://dashscope.aliyuncs.com': 'sk-dashscope-5678',
    });
  });

  it('writeActiveModelToOriginCache deletes the entry when the key is cleared', () => {
    const a = writeActiveModelToOriginCache(
      makeSettings({
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-openai',
        apiKeyByOrigin: { 'https://api.openai.com': 'sk-openai' },
      }),
      { apiKey: '' },
    );
    expect(a.apiKey).toBe('');
    expect(a.apiKeyByOrigin).toEqual({});
  });

  it('migrate copies the legacy apiKey into the active origin on first read', () => {
    const legacy = makeSettings({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-openai',
    });
    const migrated = migrateProviderModelsToOriginCache(legacy);
    expect(migrated.apiKeyByOrigin).toEqual({
      'https://api.openai.com': 'sk-openai',
    });
    // Legacy top-level field is preserved for the public view.
    expect(migrated.apiKey).toBe('sk-openai');
  });

  it('switching between two providers preserves each key independently', () => {
    let s = makeSettings({ baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-openai' });
    s = writeActiveModelToOriginCache(s, { model: 'gpt-4o' });
    s = switchBaseUrlWithModelCache(s, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
    s = writeActiveModelToOriginCache(s, { model: 'qwen-plus', apiKey: 'sk-qwen' });
    // Switch back to OpenAI.
    s = switchBaseUrlWithModelCache(s, 'https://api.openai.com/v1');
    expect(s.apiKey).toBe('sk-openai');
    expect(s.model).toBe('gpt-4o');
    // Switch back to DashScope.
    s = switchBaseUrlWithModelCache(s, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
    expect(s.apiKey).toBe('sk-qwen');
    expect(s.model).toBe('qwen-plus');
  });
});
