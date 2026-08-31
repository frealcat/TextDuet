import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TranslationProvider } from '@/src/providers/types';

const mocks = vi.hoisted(() => ({
  getApiKey: vi.fn(),
  lookupTranslationCache: vi.fn(),
  storeTranslationCache: vi.fn(),
  getTranslationCacheGeneration: vi.fn(),
  estimateTranslation: vi.fn(),
  getCostDashboard: vi.fn(),
  settleTranslation: vi.fn(),
  hasTranslationConsent: vi.fn(),
}));

vi.mock('@/src/storage/settings', () => ({
  getApiKey: mocks.getApiKey,
  providerSettingsStorage: {
    getValue: vi.fn(async () => ({
      provider: 'openai-compatible',
      baseUrl: 'https://api.example.com/v1',
      model: 'example-model',
      apiKeyPersistence: 'session',
      targetLanguage: 'zh-CN',
      displayMode: 'bilingual',
      customSystemPrompt: '',
    })),
  },
}));

vi.mock('@/src/storage/translation-cache', () => ({
  lookupTranslationCache: mocks.lookupTranslationCache,
  storeTranslationCache: mocks.storeTranslationCache,
  getTranslationCacheGeneration: mocks.getTranslationCacheGeneration,
}));

vi.mock('@/src/storage/cost-service', () => ({
  estimateTranslation: mocks.estimateTranslation,
  getCostDashboard: mocks.getCostDashboard,
  settleTranslation: mocks.settleTranslation,
}));

vi.mock('@/src/storage/translation-consent', () => ({
  hasTranslationConsent: mocks.hasTranslationConsent,
}));

import { translateStreamWithCache, translateWithCache } from '@/src/background/translation-service';

const request = {
  sourceLanguage: 'auto',
  targetLanguage: 'zh-CN',
  blocks: [
    { id: 'one', text: 'One' },
    { id: 'two', text: 'Two' },
  ],
};

const today = {
  date: '2026-08-17',
  currency: 'USD' as const,
  inputTokens: 10,
  outputTokens: 10,
  actualCost: 0.01,
  estimatedCost: 0,
  totalCost: 0.01,
  hasActualUsage: true,
  hasEstimatedUsage: false,
  budgetEnabled: false,
  dailyBudget: 0,
  budgetPercentage: 0,
  notifiedThresholds: [],
};

describe('translation service cache orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApiKey.mockResolvedValue('local-test-placeholder');
    mocks.getTranslationCacheGeneration.mockReturnValue(0);
    mocks.hasTranslationConsent.mockResolvedValue(true);
    mocks.storeTranslationCache.mockResolvedValue(undefined);
    mocks.getCostDashboard.mockResolvedValue({
      settings: {
        version: 1,
        price: {
          enabled: false,
          model: '',
          currency: 'USD',
          inputPerMillion: 0,
          outputPerMillion: 0,
          updatedAt: '2026-08-17',
          source: 'user',
        },
        budget: { enabled: false, dailyLimit: 0 },
      },
      today,
      isPriceForCurrentModel: false,
      isLedgerAvailable: true,
    });
    mocks.settleTranslation.mockResolvedValue({
      usage: { inputTokens: 8, outputTokens: 4, kind: 'actual' },
      cost: {
        currency: 'USD',
        amount: 0.001,
        isEstimate: false,
        today,
        crossedThresholds: [],
        isLedgerRecorded: true,
      },
    });
  });

  it('returns a full cache hit without reading the Key or calling the Provider', async () => {
    mocks.lookupTranslationCache.mockResolvedValue({
      cachedBlocks: [
        { id: 'one', translatedText: '一' },
        { id: 'two', translatedText: '二' },
      ],
      missingBlocks: [],
    });
    const provider = createProvider();

    const response = await translateWithCache(provider, request, new AbortController().signal);

    expect(provider.translate).not.toHaveBeenCalled();
    expect(mocks.getApiKey).not.toHaveBeenCalled();
    expect(mocks.settleTranslation).not.toHaveBeenCalled();
    expect(response.usage).toEqual({ inputTokens: 0, outputTokens: 0, kind: 'cached' });
    expect(response.cost.amount).toBe(0);
    expect(response.cache).toEqual({ hitCount: 2, missCount: 0, isAvailable: true });
  });

  it('sends only cache misses and restores the original block order', async () => {
    mocks.lookupTranslationCache.mockResolvedValue({
      cachedBlocks: [{ id: 'one', translatedText: '一' }],
      missingBlocks: [{ id: 'two', text: 'Two' }],
    });
    const provider = createProvider();
    vi.mocked(provider.translate).mockResolvedValue({
      model: 'example-model',
      blocks: [{ id: 'two', translatedText: '二' }],
      usage: { inputTokens: 8, outputTokens: 4, kind: 'actual' },
    });

    const response = await translateWithCache(provider, request, new AbortController().signal);

    expect(provider.translate).toHaveBeenCalledWith(
      expect.any(Object),
      'local-test-placeholder',
      { ...request, blocks: [{ id: 'two', text: 'Two' }] },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mocks.storeTranslationCache).toHaveBeenCalledWith(
      expect.any(Object),
      { ...request, blocks: [{ id: 'two', text: 'Two' }] },
      expect.any(String),
      [{ id: 'two', translatedText: '二' }],
      { generation: 0 },
    );
    expect(response.blocks).toEqual([
      { id: 'one', translatedText: '一' },
      { id: 'two', translatedText: '二' },
    ]);
    expect(response.cache).toEqual({ hitCount: 1, missCount: 1, isAvailable: true });
  });

  it('blocks a cache miss before reading the Key or calling the Provider when consent is absent', async () => {
    mocks.hasTranslationConsent.mockResolvedValue(false);
    mocks.lookupTranslationCache.mockResolvedValue({
      cachedBlocks: [],
      missingBlocks: request.blocks,
    });
    const provider = createProvider();

    await expect(
      translateWithCache(provider, request, new AbortController().signal),
    ).rejects.toThrow('首次发送网页文本前需要确认数据去向与模型费用');
    expect(mocks.getApiKey).not.toHaveBeenCalled();
    expect(provider.translate).not.toHaveBeenCalled();
  });

  it('allows a cache miss after the current consent version is confirmed', async () => {
    mocks.hasTranslationConsent.mockResolvedValue(true);
    mocks.lookupTranslationCache.mockResolvedValue({
      cachedBlocks: [],
      missingBlocks: request.blocks,
    });
    const provider = createProvider();
    vi.mocked(provider.translate).mockResolvedValue({
      model: 'example-model',
      blocks: request.blocks.map((block) => ({ id: block.id, translatedText: `译文-${block.id}` })),
      usage: { inputTokens: 8, outputTokens: 4, kind: 'actual' },
    });

    await translateWithCache(provider, request, new AbortController().signal);
    expect(mocks.hasTranslationConsent).toHaveBeenCalledOnce();
    expect(provider.translate).toHaveBeenCalledOnce();
  });

  it('continues without cache when IndexedDB lookup fails', async () => {
    mocks.lookupTranslationCache.mockRejectedValue(new Error('IndexedDB unavailable'));
    const provider = createProvider();
    vi.mocked(provider.translate).mockResolvedValue({
      model: 'example-model',
      blocks: [
        { id: 'one', translatedText: '一' },
        { id: 'two', translatedText: '二' },
      ],
    });

    const response = await translateWithCache(provider, request, new AbortController().signal);

    expect(provider.translate).toHaveBeenCalledWith(
      expect.any(Object),
      'local-test-placeholder',
      request,
      expect.any(Object),
    );
    expect(response.cache).toEqual({ hitCount: 0, missCount: 2, isAvailable: false });
  });

  it('bypasses cache and omits refresh control from the Provider request', async () => {
    const provider = createProvider();
    vi.mocked(provider.translate).mockResolvedValue({
      model: 'example-model',
      blocks: [
        { id: 'one', translatedText: '新一' },
        { id: 'two', translatedText: '新二' },
      ],
      usage: { inputTokens: 8, outputTokens: 4, kind: 'actual' },
    });

    const response = await translateWithCache(
      provider,
      { ...request, forceRefresh: true },
      new AbortController().signal,
    );

    expect(mocks.lookupTranslationCache).not.toHaveBeenCalled();
    expect(provider.translate).toHaveBeenCalledWith(
      expect.any(Object),
      'local-test-placeholder',
      request,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(response.cache).toEqual({ hitCount: 0, missCount: 2, isAvailable: true });
    expect(response.blocks[0]?.translatedText).toBe('新一');
  });

  it('publishes stream blocks only after the provider returns a complete response', async () => {
    mocks.lookupTranslationCache.mockResolvedValue({
      cachedBlocks: [],
      missingBlocks: request.blocks,
    });
    const provider = createProvider();
    vi.mocked(provider.translateStream).mockImplementation(async (_settings, _key, _request, options) => {
      options?.onBlock?.({ id: 'one', translatedText: '一' });
      throw new Error('incomplete stream');
    });
    const published: unknown[] = [];

    await expect(
      translateStreamWithCache(provider, request, new AbortController().signal, (block) => published.push(block)),
    ).rejects.toThrow('incomplete stream');
    expect(published).toEqual([]);
  });

  it('publishes a complete stream response in source order', async () => {
    mocks.lookupTranslationCache.mockResolvedValue({
      cachedBlocks: [{ id: 'one', translatedText: '一' }],
      missingBlocks: [{ id: 'two', text: 'Two' }],
    });
    const provider = createProvider();
    vi.mocked(provider.translateStream).mockResolvedValue({
      model: 'example-model',
      blocks: [{ id: 'two', translatedText: '二' }],
      isStreaming: true,
      usage: { inputTokens: 8, outputTokens: 4, kind: 'actual' },
    });
    const published: string[] = [];

    await translateStreamWithCache(provider, request, new AbortController().signal, (block) => {
      published.push(block.translatedText);
    });
    expect(published).toEqual(['一', '二']);
  });
});

function createProvider(): TranslationProvider {
  return {
    translate: vi.fn(),
    translateStream: vi.fn(),
    testConnection: vi.fn(),
  };
}
