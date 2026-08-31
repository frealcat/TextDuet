import { describe, expect, it } from 'vitest';
import {
  parseOfficialModelPricing,
  parseCompatibilityDiagnostic,
  parseCompatibilityPageSnapshot,
  parseI18nBatchTranslationResult,
  parseProviderBalance,
  parsePublicProviderSettings,
  parseRuntimeMessage,
  parseTranslationBatchResponse,
  parseUsageHistoryDashboard,
} from '@/src/core/schemas';

const validSettings = {
  provider: 'openai-compatible' as const,
  baseUrl: 'https://api.example.com/v1',
  model: 'example-model',
  apiKeyPersistence: 'session' as const,
  targetLanguage: 'zh-CN',
  displayMode: 'bilingual' as const,
  customSystemPrompt: '',
};

describe('runtime schemas', () => {
  it('accepts a complete settings message', () => {
    expect(
      parseRuntimeMessage({
        type: 'SAVE_PROVIDER_SETTINGS',
        settings: validSettings,
        apiKey: 'test-placeholder-key',
      }),
    ).toMatchObject({ type: 'SAVE_PROVIDER_SETTINGS', settings: validSettings });
  });

  it('accepts multiple models and a validated translation color', () => {
    expect(parseRuntimeMessage({
      type: 'SAVE_PROVIDER_SETTINGS',
      settings: {
        ...validSettings,
        models: ['example-model', 'example-fast'],
        translationColor: 'rgba(20, 125, 100, 0.85)',
      },
    })).toMatchObject({
      settings: { model: 'example-model', models: ['example-model', 'example-fast'] },
    });
    expect(() => parseRuntimeMessage({
      type: 'SAVE_PROVIDER_SETTINGS',
      settings: { ...validSettings, translationColor: 'red; background: url(evil)' },
    })).toThrow('扩展消息格式无效');
  });

  it('accepts Popup state, model, and display mode controls', () => {
    expect(parseRuntimeMessage({ type: 'GET_ACTIVE_TAB_TRANSLATION_STATE' })).toEqual({
      type: 'GET_ACTIVE_TAB_TRANSLATION_STATE',
    });
    expect(parseRuntimeMessage({
      type: 'SET_ACTIVE_TAB_DISPLAY_MODE',
      displayMode: 'source-only',
    })).toMatchObject({ displayMode: 'source-only' });
    expect(parseRuntimeMessage({ type: 'SET_ACTIVE_MODEL', model: 'example-fast' }))
      .toMatchObject({ model: 'example-fast' });
  });

  it('accepts language preferences and streaming messages', () => {
    expect(parseRuntimeMessage({
      type: 'SET_LANGUAGE_PREFERENCES', sourceLanguage: 'auto', targetLanguage: 'system',
    })).toMatchObject({ targetLanguage: 'system' });
    expect(parseRuntimeMessage({
      type: 'TRANSLATE_BATCH_STREAM',
      request: { sourceLanguage: 'auto', targetLanguage: 'en', blocks: [{ id: 'one', text: 'One' }] },
    })).toMatchObject({ type: 'TRANSLATE_BATCH_STREAM' });
  });

  it('rejects arbitrary network fields from a content script', () => {
    expect(() =>
      parseRuntimeMessage({
        type: 'TRANSLATE_BATCH',
        url: 'https://attacker.example/collect',
        request: {
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          blocks: [{ id: 'block-1', text: 'Hello world' }],
        },
      }),
    ).toThrow('扩展消息格式无效');
  });

  it('accepts cache dashboard and clear messages without secret fields', () => {
    expect(parseRuntimeMessage({ type: 'GET_TRANSLATION_CACHE_DASHBOARD' })).toEqual({
      type: 'GET_TRANSLATION_CACHE_DASHBOARD',
    });
    expect(parseRuntimeMessage({ type: 'CLEAR_TRANSLATION_CACHE' })).toEqual({
      type: 'CLEAR_TRANSLATION_CACHE',
    });
    expect(() =>
      parseRuntimeMessage({ type: 'CLEAR_TRANSLATION_CACHE', apiKey: 'forbidden' }),
    ).toThrow('扩展消息格式无效');
  });

  it('accepts local diagnostic requests but rejects URL and secret fields', () => {
    expect(parseRuntimeMessage({
      type: 'GET_COMPATIBILITY_DIAGNOSTIC',
      includePath: false,
    })).toEqual({ type: 'GET_COMPATIBILITY_DIAGNOSTIC', includePath: false });
    expect(parseRuntimeMessage({ type: 'GET_TRANSLATION_DIAGNOSTIC' })).toEqual({
      type: 'GET_TRANSLATION_DIAGNOSTIC',
    });
    expect(() => parseRuntimeMessage({
      type: 'GET_COMPATIBILITY_DIAGNOSTIC',
      includePath: true,
      url: 'https://private.example/article',
      apiKey: 'forbidden',
    })).toThrow('扩展消息格式无效');
  });

  it('validates redacted page diagnostic counters', () => {
    expect(parseCompatibilityPageSnapshot({
      candidateCount: 4,
      translatedCount: 3,
      failedBatchCount: 1,
      hasRun: true,
    })).toMatchObject({ translatedCount: 3, hasRun: true });
  });

  it('accepts trusted usage and pricing requests but rejects undeclared secrets', () => {
    expect(parseRuntimeMessage({ type: 'GET_USAGE_HISTORY' })).toEqual({
      type: 'GET_USAGE_HISTORY',
    });
    expect(parseRuntimeMessage({
      type: 'REFRESH_PROVIDER_PRICING',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'openai/example-mini',
    })).toMatchObject({ type: 'REFRESH_PROVIDER_PRICING' });
    expect(() => parseRuntimeMessage({
      type: 'REFRESH_PROVIDER_PRICING',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'openai/example-mini',
      apiKey: 'must-not-cross-this-boundary',
    })).toThrow('扩展消息格式无效');
    expect(parseRuntimeMessage({ type: 'GET_PROVIDER_BALANCE' })).toEqual({
      type: 'GET_PROVIDER_BALANCE',
    });
    expect(() => parseRuntimeMessage({
      type: 'GET_PROVIDER_BALANCE',
      apiKey: 'must-not-cross-this-boundary',
    })).toThrow('扩展消息格式无效');
  });

  it('validates redacted Provider balance responses', () => {
    expect(parseProviderBalance({
      status: 'available',
      providerLabel: 'DeepSeek',
      isAvailable: true,
      balances: [{
        currency: 'CNY',
        totalBalance: '12.50',
        grantedBalance: '2.50',
        toppedUpBalance: '10.00',
      }],
      checkedAt: '2026-08-18',
      sourceUrl: 'https://api-docs.deepseek.com/api/get-user-balance',
    })).toMatchObject({ status: 'available', providerLabel: 'DeepSeek' });
    expect(parseProviderBalance({ status: 'unsupported' })).toEqual({
      status: 'unsupported',
    });
    expect(() => parseProviderBalance({
      status: 'available',
      providerLabel: 'DeepSeek',
      isAvailable: true,
      balances: [],
      checkedAt: '2026-08-18',
      sourceUrl: 'https://api-docs.deepseek.com/api/get-user-balance',
      apiKey: 'forbidden',
    })).toThrow('扩展返回的余额格式无效');
  });

  it('validates local compatibility packages and excludes screenshots', () => {
    expect(parseCompatibilityDiagnostic({
      schemaVersion: 1,
      generatedAt: '2026-08-18T05:30:00.000Z',
      extensionVersion: '0.1.0',
      chromeVersion: '151.0.7922.34',
      page: { hostname: 'example.com' },
      metrics: { candidateCount: 2, translatedCount: 2, failedBatchCount: 0 },
      issue: { type: 'dynamic-content' },
      screenshotIncluded: false,
    })).toMatchObject({ page: { hostname: 'example.com' } });
    expect(() => parseCompatibilityDiagnostic({
      schemaVersion: 1,
      generatedAt: '2026-08-18T05:30:00.000Z',
      extensionVersion: '0.1.0',
      chromeVersion: '151.0.7922.34',
      page: { hostname: 'example.com' },
      metrics: { candidateCount: 2, translatedCount: 2, failedBatchCount: 0 },
      issue: { type: 'other' },
      screenshotIncluded: true,
    })).toThrow('诊断包格式无效');
  });

  it('validates gap-free usage history and optional official pricing responses', () => {
    expect(parseUsageHistoryDashboard({
      days: 1,
      points: [{
        date: '2026-08-18',
        inputTokens: 120,
        outputTokens: 40,
        hasEstimatedUsage: false,
      }],
      totalInputTokens: 120,
      totalOutputTokens: 40,
      hasEstimatedUsage: false,
      models: [{
        provider: 'openai-compatible',
        model: 'qwen-plus',
        points: [{
          date: '2026-08-18',
          inputTokens: 120,
          outputTokens: 40,
          hasEstimatedUsage: false,
        }],
        totalInputTokens: 120,
        totalOutputTokens: 40,
        hasEstimatedUsage: false,
      }],
      isLedgerAvailable: true,
      source: 'local',
    })).toMatchObject({ days: 1, source: 'local' });
    expect(() => parseUsageHistoryDashboard({
      days: 2,
      points: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
      hasEstimatedUsage: false,
      models: [],
      isLedgerAvailable: true,
      source: 'local',
    })).toThrow('扩展返回的用量历史格式无效');
    expect(parseOfficialModelPricing({ status: 'unavailable' })).toEqual({
      status: 'unavailable',
    });
  });

  it('rejects secret fields and invalid budgets in cost settings', () => {
    expect(() =>
      parseRuntimeMessage({
        type: 'SAVE_COST_SETTINGS',
        settings: {
          version: 1,
          price: {
            enabled: true,
            model: 'example-model',
            currency: 'USD',
            inputPerMillion: 1,
            outputPerMillion: 2,
            updatedAt: '2026-08-14',
            source: 'user',
            apiKey: 'must-not-enter-the-ledger',
          },
          budget: { enabled: true, dailyLimit: 0 },
        },
      }),
    ).toThrow('扩展消息格式无效');
  });

  it('rejects duplicate source block IDs', () => {
    expect(() =>
      parseRuntimeMessage({
        type: 'TRANSLATE_BATCH',
        request: {
          sourceLanguage: 'auto',
          targetLanguage: 'zh-CN',
          blocks: [
            { id: 'duplicate', text: 'First block' },
            { id: 'duplicate', text: 'Second block' },
          ],
        },
      }),
    ).toThrow('扩展消息格式无效');
  });

  it('bounds trusted i18n batches by key and character count', () => {
    const base = {
      type: 'TRANSLATE_I18N_BATCH' as const,
      targetTag: 'fr-FR',
      targetLocale: 'Français',
    };
    expect(parseRuntimeMessage({ ...base, sourceBatch: { 'ui.title': 'Title' } }))
      .toMatchObject({ type: 'TRANSLATE_I18N_BATCH' });
    expect(() => parseRuntimeMessage({
      ...base,
      sourceBatch: Object.fromEntries(Array.from({ length: 51 }, (_, index) => [`k${index}`, 'v'])),
    })).toThrow('扩展消息格式无效');
    expect(() => parseRuntimeMessage({
      ...base,
      sourceBatch: { [`k${'x'.repeat(128)}`]: 'v' },
    })).toThrow('扩展消息格式无效');
    expect(() => parseRuntimeMessage({
      ...base,
      sourceBatch: { key: 'x'.repeat(4_001) },
    })).toThrow('扩展消息格式无效');
    expect(() => parseRuntimeMessage({
      ...base,
      sourceBatch: { first: 'x'.repeat(32_000), second: 'y'.repeat(32_000) },
    })).toThrow('扩展消息格式无效');
  });

  it('bounds untrusted i18n response dictionaries', () => {
    expect(parseI18nBatchTranslationResult({
      ok: true,
      translations: { 'ui.title': 'Translated title' },
    })).toMatchObject({ ok: true });
    expect(() => parseI18nBatchTranslationResult({
      ok: true,
      translations: Object.fromEntries(Array.from({ length: 51 }, (_, index) => [`k${index}`, 'v'])),
    })).toThrow('扩展返回的 i18n 翻译结果格式无效');
    expect(() => parseI18nBatchTranslationResult({
      ok: true,
      translations: { [`k${'x'.repeat(128)}`]: 'v' },
    })).toThrow('扩展返回的 i18n 翻译结果格式无效');
    expect(() => parseI18nBatchTranslationResult({
      ok: true,
      translations: { key: 'x'.repeat(16_001) },
    })).toThrow('扩展返回的 i18n 翻译结果格式无效');
    expect(() => parseI18nBatchTranslationResult({
      ok: true,
      model: 'm'.repeat(257),
    })).toThrow('扩展返回的 i18n 翻译结果格式无效');
    expect(() => parseI18nBatchTranslationResult({
      ok: true,
      translations: { first: 'x'.repeat(32_000), second: 'y'.repeat(32_000) },
    })).toThrow('扩展返回的 i18n 翻译结果格式无效');

    const prototypePayload = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(prototypePayload, '__proto__', {
      value: 'must be rejected',
      enumerable: true,
    });
    const parsedPrototypePayload = parseI18nBatchTranslationResult({
      ok: true,
      translations: prototypePayload,
    });
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
    expect(Object.keys(parsedPrototypePayload.translations ?? {})).not.toContain('__proto__');
  });

  it('rejects insecure Provider URLs and incomplete saved settings', () => {
    expect(() =>
      parseRuntimeMessage({
        type: 'SAVE_PROVIDER_SETTINGS',
        settings: { ...validSettings, baseUrl: 'http://api.example.com', model: '' },
      }),
    ).toThrow('扩展消息格式无效');
    for (const baseUrl of [
      'https://user:password@api.example.com/v1',
      'https://api.example.com/v1?token=secret',
      'https://api.example.com/v1#fragment',
    ]) {
      expect(() => parseRuntimeMessage({
        type: 'SAVE_PROVIDER_SETTINGS',
        settings: { ...validSettings, baseUrl },
      })).toThrow('扩展消息格式无效');
    }
  });

  it('rejects an API Key leaked into public settings', () => {
    expect(() =>
      parsePublicProviderSettings({
        ...validSettings,
        hasApiKey: true,
        apiKey: 'must-not-cross-this-boundary',
      }),
    ).toThrow('扩展返回的配置格式无效');
  });

  it('rejects malformed translation responses before DOM rendering', () => {
    expect(() =>
      parseTranslationBatchResponse({
        model: 'example-model',
        blocks: [{ id: 'block-1', translatedText: '<script>alert(1)</script>', extra: true }],
      }),
    ).toThrow('扩展返回的译文格式无效');
  });
});
