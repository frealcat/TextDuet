import type {
  ProviderSettings,
  TranslationBatchRequest,
  TranslationBatchResponse,
  TranslationEstimateResponse,
} from '@/src/core/contracts';
import type { TranslatedBlock } from '@/src/core/contracts';
import { effectivePriceForModel } from '@/src/core/cost';
import { parseConfiguredProviderSettings } from '@/src/core/schemas';
import { mergeTranslationBlocks } from '@/src/core/translation-cache';
import { resolveSystemPrompt } from '@/src/core/translation-prompt';
import type { TranslationProvider } from '@/src/providers/types';
import {
  estimateTranslation,
  getCostDashboard,
  settleTranslation,
} from '@/src/storage/cost-service';
import { getApiKey, providerSettingsStorage } from '@/src/storage/settings';
import {
  getTranslationCacheGeneration,
  lookupTranslationCache,
  storeTranslationCache,
  type TranslationCacheLookup,
} from '@/src/storage/translation-cache';
import { hasTranslationConsent } from '@/src/storage/translation-consent';

/** Raised before a cache miss would send visible webpage text to a Provider. */
export class TranslationConsentRequiredError extends Error {
  constructor() {
    super('首次发送网页文本前需要确认数据去向与模型费用');
    this.name = 'TranslationConsentRequiredError';
  }
}

interface SafeCacheLookup extends TranslationCacheLookup {
  isAvailable: boolean;
}

export async function estimateTranslationWithCache(
  request: TranslationBatchRequest,
): Promise<TranslationEstimateResponse> {
  const settings = await getConfiguredSettings();
  const systemPrompt = resolveSystemPrompt(settings, request);
  const cache = await lookupCacheSafely(settings, request, systemPrompt);
  const cacheSummary = {
    hitCount: cache.cachedBlocks.length,
    missCount: cache.missingBlocks.length,
    isAvailable: cache.isAvailable,
  };

  if (cache.missingBlocks.length > 0) {
    const estimate = await estimateTranslation(
      settings,
      { ...request, blocks: cache.missingBlocks },
      systemPrompt,
    );
    return { ...estimate, cache: cacheSummary };
  }

  const dashboard = await getCostDashboard(settings.model);
  const price = effectivePriceForModel(dashboard.settings.price, settings.model);
  return {
    estimate: {
      inputTokens: 0,
      outputTokensMin: 0,
      outputTokensMax: 0,
      currency: price.currency,
      costMin: 0,
      costMax: 0,
      isPriceConfigured: price.enabled,
    },
    today: dashboard.today,
    isLedgerAvailable: dashboard.isLedgerAvailable,
    cache: cacheSummary,
  };
}

export async function translateWithCache(
  provider: TranslationProvider,
  request: TranslationBatchRequest,
  signal: AbortSignal,
): Promise<TranslationBatchResponse> {
  const cacheGeneration = getTranslationCacheGeneration();
  const settings = await getConfiguredSettings();
  const systemPrompt = resolveSystemPrompt(settings, request);
  const cache = await lookupCacheSafely(settings, request, systemPrompt);
  const cacheSummary = {
    hitCount: cache.cachedBlocks.length,
    missCount: cache.missingBlocks.length,
    isAvailable: cache.isAvailable,
  };

  if (cache.missingBlocks.length === 0) {
    const dashboard = await getCostDashboard(settings.model);
    const blocks = mergeTranslationBlocks(request.blocks, cache.cachedBlocks, []);
    return {
      blocks,
      model: settings.model,
      usage: { inputTokens: 0, outputTokens: 0, kind: 'cached' },
      cost: {
        currency: dashboard.today.currency,
        amount: 0,
        isEstimate: false,
        today: dashboard.today,
        crossedThresholds: [],
        isLedgerRecorded: true,
      },
      cache: cacheSummary,
    };
  }

  await assertTranslationConsent();

  const uncachedRequest = {
    sourceLanguage: request.sourceLanguage,
    targetLanguage: request.targetLanguage,
    blocks: cache.missingBlocks,
  };
  // TD-2026-028: resolve through the per-origin map so a baseUrl switch
  // uses the key saved for the current origin instead of the legacy
  // global slot (which holds only the last saved key).
  const apiKey = await getApiKey(settings.apiKeyPersistence, settings.baseUrl, {
    apiKeyByOrigin: settings.apiKeyByOrigin,
  });
  const result = await provider.translate(settings, apiKey, uncachedRequest, { signal });
  const settlement = await settleTranslation(
    settings,
    uncachedRequest,
    systemPrompt,
    result.usage,
  );
  const isCacheStored = await storeTranslationCache(
    settings,
    uncachedRequest,
    systemPrompt,
    result.blocks,
    { generation: cacheGeneration },
  ).then((stored) => stored !== false, () => false);

  return {
    blocks: mergeTranslationBlocks(request.blocks, cache.cachedBlocks, result.blocks),
    model: result.model,
    usage: settlement.usage,
    cost: settlement.cost,
    cache: {
      ...cacheSummary,
      isAvailable: cacheSummary.isAvailable && isCacheStored,
    },
  };
}

export async function translateStreamWithCache(
  provider: TranslationProvider,
  request: TranslationBatchRequest,
  signal: AbortSignal,
  onBlock: (block: TranslatedBlock) => void,
): Promise<TranslationBatchResponse> {
  const cacheGeneration = getTranslationCacheGeneration();
  const settings = await getConfiguredSettings();
  const systemPrompt = resolveSystemPrompt(settings, request);
  const cache = await lookupCacheSafely(settings, request, systemPrompt);
  const cacheSummary = { hitCount: cache.cachedBlocks.length, missCount: cache.missingBlocks.length, isAvailable: cache.isAvailable };
  if (cache.missingBlocks.length === 0) {
    const dashboard = await getCostDashboard(settings.model);
    const blocks = mergeTranslationBlocks(request.blocks, cache.cachedBlocks, []);
    blocks.forEach(onBlock);
    return {
      blocks,
      model: settings.model, usage: { inputTokens: 0, outputTokens: 0, kind: 'cached' },
      cost: { currency: dashboard.today.currency, amount: 0, isEstimate: false, today: dashboard.today, crossedThresholds: [], isLedgerRecorded: true },
      cache: cacheSummary,
    };
  }
  await assertTranslationConsent();
  const uncachedRequest = { sourceLanguage: request.sourceLanguage, targetLanguage: request.targetLanguage, blocks: cache.missingBlocks };
  // TD-2026-028: resolve through the per-origin map so a baseUrl switch
  // uses the key saved for the current origin instead of the legacy
  // global slot (which holds only the last saved key).
  const apiKey = await getApiKey(settings.apiKeyPersistence, settings.baseUrl, {
    apiKeyByOrigin: settings.apiKeyByOrigin,
  });
  let result;
  try {
    result = await provider.translateStream(settings, apiKey, uncachedRequest, {
      signal,
      // Keep provider callbacks inside the trusted worker until the complete
      // response has passed envelope and ID validation. A provider must not be
      // able to leave partial DOM output when its stream later fails.
      onBlock: () => undefined,
    });
  } catch (error) {
    const usage = error && typeof error === 'object' && 'usage' in error
      ? (error as { usage?: import('@/src/core/contracts').ModelUsage }).usage
      : undefined;
    if (usage) await settleTranslation(settings, uncachedRequest, systemPrompt, usage);
    throw error;
  }
  const settlement = await settleTranslation(settings, uncachedRequest, systemPrompt, result.usage);
  const mergedBlocks = mergeTranslationBlocks(request.blocks, cache.cachedBlocks, result.blocks);
  const isCacheStored = await storeTranslationCache(
    settings,
    uncachedRequest,
    systemPrompt,
    result.blocks,
    { generation: cacheGeneration },
  ).then((stored) => stored !== false, () => false);
  // Publish only the validated, complete response after bookkeeping has a
  // coherent result. The caller can safely render these blocks atomically.
  mergedBlocks.forEach(onBlock);
  return {
    blocks: mergedBlocks,
    model: result.model, usage: settlement.usage, cost: settlement.cost,
    cache: { ...cacheSummary, isAvailable: cacheSummary.isAvailable && isCacheStored },
  };
}

async function getConfiguredSettings(): Promise<ProviderSettings> {
  return parseConfiguredProviderSettings(await providerSettingsStorage.getValue());
}

async function assertTranslationConsent(): Promise<void> {
  if (!(await hasTranslationConsent())) throw new TranslationConsentRequiredError();
}

async function lookupCacheSafely(
  settings: ProviderSettings,
  request: TranslationBatchRequest,
  systemPrompt: string,
): Promise<SafeCacheLookup> {
  if (request.forceRefresh) {
    return { cachedBlocks: [], missingBlocks: request.blocks, isAvailable: true };
  }
  return lookupTranslationCache(settings, request, systemPrompt).then(
    (result) => ({ ...result, isAvailable: true }),
    () => ({ cachedBlocks: [], missingBlocks: request.blocks, isAvailable: false }),
  );
}
