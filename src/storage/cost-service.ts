import type {
  CostDashboard,
  CostSettings,
  CostSettlement,
  ModelUsage,
  ProviderSettings,
  TranslationBatchRequest,
  TranslationEstimateResponse,
  UsageHistoryDashboard,
} from '@/src/core/contracts';
import {
  createEmptyTodayUsage,
  effectivePriceForModel,
  estimateTranslationCost,
  getLocalDateKey,
  settleUsage,
} from '@/src/core/cost';
import { parseCostSettings } from '@/src/core/schemas';
import { costSettingsStorage } from './settings';
import {
  aggregateDailyUsage,
  getUsageRetentionStartDate,
} from '@/src/core/usage-history';
import {
  clearUsageLedger,
  getTodayUsage,
  getUsageHistory,
  maintainUsageLedger,
  recordUsage,
} from './usage-ledger';

export const USAGE_RETENTION_DAYS = 60;

export async function getCostDashboard(model: string): Promise<CostDashboard> {
  const settings = await getCostSettings();
  const date = getLocalDateKey();
  let isLedgerAvailable = true;
  const today = await maintainAndGetTodayUsage(
    date,
    settings.price.currency,
    settings.budget,
  ).catch(() => {
    isLedgerAvailable = false;
    return createEmptyTodayUsage(date, settings.price.currency, settings.budget);
  });
  return {
    settings,
    today,
    isPriceForCurrentModel: settings.price.enabled && settings.price.model === model,
    isLedgerAvailable,
  };
}

export async function saveCostSettings(settings: CostSettings): Promise<void> {
  await costSettingsStorage.setValue(parseCostSettings(settings));
}

export async function estimateTranslation(
  providerSettings: ProviderSettings,
  request: TranslationBatchRequest,
  systemPrompt: string,
): Promise<Omit<TranslationEstimateResponse, 'cache'>> {
  const settings = await getCostSettings();
  const price = effectivePriceForModel(settings.price, providerSettings.model);
  const estimate = estimateTranslationCost(request, systemPrompt, price);
  const date = getLocalDateKey();
  let isLedgerAvailable = true;
  const today = await maintainAndGetTodayUsage(date, price.currency, settings.budget).catch(() => {
    isLedgerAvailable = false;
    return createEmptyTodayUsage(date, price.currency, settings.budget);
  });
  return { estimate, today, isLedgerAvailable };
}

export async function settleTranslation(
  providerSettings: ProviderSettings,
  request: TranslationBatchRequest,
  systemPrompt: string,
  actualUsage?: ModelUsage,
): Promise<{ usage: ModelUsage; cost: CostSettlement }> {
  const settings = await getCostSettings();
  const price = effectivePriceForModel(settings.price, providerSettings.model);
  const estimate = estimateTranslationCost(request, systemPrompt, price);
  const settlement = settleUsage(actualUsage, estimate, price);
  const date = getLocalDateKey();
  const ledger = actualUsage?.kind === 'actual'
    ? await maintainUsageLedger(getUsageRetentionStartDate(date, USAGE_RETENTION_DAYS))
      .then(() => recordUsage(
        {
          date,
          provider: providerSettings.provider,
          model: providerSettings.model,
          currency: price.currency,
          usage: actualUsage,
          amount: settlement.amount,
          isEstimate: false,
        },
        settings.budget,
      ))
      .catch(() => null)
    : null;
  const today = ledger?.today || await maintainAndGetTodayUsage(
    date,
    price.currency,
    settings.budget,
  ).catch(() => createEmptyTodayUsage(date, price.currency, settings.budget));

  return {
    usage: settlement.usage,
    cost: {
      currency: price.currency,
      amount: settlement.amount,
      isEstimate: settlement.isEstimate,
      today,
      crossedThresholds: ledger?.crossedThresholds || [],
      isLedgerRecorded: Boolean(ledger),
    },
  };
}

export async function clearCostUsage(): Promise<void> {
  await clearUsageLedger();
}

export async function getLocalUsageHistory(): Promise<UsageHistoryDashboard> {
  const endDate = getLocalDateKey();
  const retentionStartDate = getUsageRetentionStartDate(endDate, USAGE_RETENTION_DAYS);
  return maintainUsageLedger(retentionStartDate)
    .then(() => getUsageHistory(endDate, USAGE_RETENTION_DAYS))
    .catch(() => ({
    days: USAGE_RETENTION_DAYS,
    points: aggregateDailyUsage([], endDate, USAGE_RETENTION_DAYS),
    totalInputTokens: 0,
    totalOutputTokens: 0,
    hasEstimatedUsage: false,
    models: [],
    isLedgerAvailable: false,
    source: 'local',
  }));
}

async function maintainAndGetTodayUsage(
  date: string,
  currency: CostSettings['price']['currency'],
  budget: CostSettings['budget'],
) {
  await maintainUsageLedger(getUsageRetentionStartDate(date, USAGE_RETENTION_DAYS));
  return getTodayUsage(date, currency, budget);
}

async function getCostSettings(): Promise<CostSettings> {
  return parseCostSettings(await costSettingsStorage.getValue());
}
