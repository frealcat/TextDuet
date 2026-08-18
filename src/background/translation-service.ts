import type {
  ProviderSettings,
  TranslationBatchRequest,
  TranslationBatchResponse,
  TranslationEstimateResponse,
} from '@/src/core/contracts';
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
  lookupTranslationCache,
  storeTranslationCache,
  type TranslationCacheLookup,
} from '@/src/storage/translation-cache';

interface SafeCacheLookup extends TranslationCacheLookup {
  isAvailable: boolean;
}

export async function estimateTranslationWithCache(
  request: TranslationBatchRequest,
): Promise<TranslationEstimateResponse> {
  const settings = await getConfiguredSettings();
  const systemPrompt = resolveSystemPrompt(settings);
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
  const settings = await getConfiguredSettings();
  const systemPrompt = resolveSystemPrompt(settings);
  const cache = await lookupCacheSafely(settings, request, systemPrompt);
  const cacheSummary = {
    hitCount: cache.cachedBlocks.length,
    missCount: cache.missingBlocks.length,
    isAvailable: cache.isAvailable,
  };

  if (cache.missingBlocks.length === 0) {
    const dashboard = await getCostDashboard(settings.model);
    return {
      blocks: mergeTranslationBlocks(request.blocks, cache.cachedBlocks, []),
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

  const uncachedRequest = {
    sourceLanguage: request.sourceLanguage,
    targetLanguage: request.targetLanguage,
    blocks: cache.missingBlocks,
  };
  const apiKey = await getApiKey(settings.apiKeyPersistence);
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
  ).then(
    () => true,
    () => false,
  );

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

async function getConfiguredSettings(): Promise<ProviderSettings> {
  return parseConfiguredProviderSettings(await providerSettingsStorage.getValue());
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
