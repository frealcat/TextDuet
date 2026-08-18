import type {
  CostEstimate,
  CostPrice,
  CostSettings,
  ModelUsage,
  TodayUsageSummary,
  TranslationBatchRequest,
} from './contracts';
import { BUDGET_THRESHOLDS } from './defaults';

const CHAT_ENVELOPE_TOKENS = 12;
const OUTPUT_RATIO_MIN = 0.8;
const OUTPUT_RATIO_MAX = 1.4;
const CJK_CHARACTER = /[\u2e80-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/u;

/** Returns a conservative, deterministic token approximation without calling a model service. */
export function estimateTextTokens(text: string): number {
  let cjkCharacters = 0;
  let otherCharacters = 0;

  for (const character of text) {
    if (CJK_CHARACTER.test(character)) {
      cjkCharacters += 1;
    } else {
      otherCharacters += 1;
    }
  }

  return Math.max(1, cjkCharacters + Math.ceil(otherCharacters / 4));
}

export function estimateTranslationCost(
  request: TranslationBatchRequest,
  systemPrompt: string,
  price: CostPrice,
): CostEstimate {
  const serializedRequest = JSON.stringify(request);
  const inputTokens =
    estimateTextTokens(systemPrompt) + estimateTextTokens(serializedRequest) + CHAT_ENVELOPE_TOKENS;
  const sourceTokens = estimateTextTokens(request.blocks.map((block) => block.text).join('\n'));
  const outputTokensMin = Math.max(1, Math.ceil(sourceTokens * OUTPUT_RATIO_MIN));
  const outputTokensMax = Math.max(outputTokensMin, Math.ceil(sourceTokens * OUTPUT_RATIO_MAX));
  const isPriceConfigured = price.enabled;

  return {
    inputTokens,
    outputTokensMin,
    outputTokensMax,
    currency: price.currency,
    costMin: isPriceConfigured
      ? calculateUsageCost(inputTokens, outputTokensMin, price)
      : 0,
    costMax: isPriceConfigured
      ? calculateUsageCost(inputTokens, outputTokensMax, price)
      : 0,
    isPriceConfigured,
  };
}

export function calculateUsageCost(
  inputTokens: number,
  outputTokens: number,
  price: CostPrice,
): number {
  return (
    (inputTokens * price.inputPerMillion + outputTokens * price.outputPerMillion) / 1_000_000
  );
}

export function settleUsage(
  actualUsage: ModelUsage | undefined,
  estimate: CostEstimate,
  price: CostPrice,
): { usage: ModelUsage; amount: number; isEstimate: boolean } {
  if (actualUsage) {
    return {
      usage: actualUsage,
      amount: price.enabled
        ? calculateUsageCost(actualUsage.inputTokens, actualUsage.outputTokens, price)
        : 0,
      isEstimate: false,
    };
  }

  return {
    usage: {
      inputTokens: estimate.inputTokens,
      outputTokens: estimate.outputTokensMax,
      kind: 'estimated',
    },
    amount: estimate.costMax,
    isEstimate: true,
  };
}

export function evaluateBudgetThresholds(
  nextAmount: number,
  settings: CostSettings['budget'],
  notifiedThresholds: readonly number[],
): { crossedThresholds: Array<50 | 80 | 100>; notifiedThresholds: Array<50 | 80 | 100> } {
  const notified = new Set(notifiedThresholds);
  const crossedThresholds: Array<50 | 80 | 100> = [];

  if (settings.enabled && settings.dailyLimit > 0) {
    for (const threshold of BUDGET_THRESHOLDS) {
      const thresholdAmount = (settings.dailyLimit * threshold) / 100;
      if (
        nextAmount >= thresholdAmount &&
        !notified.has(threshold)
      ) {
        crossedThresholds.push(threshold);
        notified.add(threshold);
      }
    }
  }

  return {
    crossedThresholds,
    notifiedThresholds: BUDGET_THRESHOLDS.filter((threshold) => notified.has(threshold)),
  };
}

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function effectivePriceForModel(price: CostPrice, model: string): CostPrice {
  return price.model === model ? price : { ...price, enabled: false };
}

export function createEmptyTodayUsage(
  date: string,
  currency: CostPrice['currency'],
  budget: CostSettings['budget'],
): TodayUsageSummary {
  return {
    date,
    currency,
    inputTokens: 0,
    outputTokens: 0,
    actualCost: 0,
    estimatedCost: 0,
    totalCost: 0,
    hasActualUsage: false,
    hasEstimatedUsage: false,
    budgetEnabled: budget.enabled,
    dailyBudget: budget.enabled ? budget.dailyLimit : 0,
    budgetPercentage: 0,
    notifiedThresholds: [],
  };
}

export function formatMoneyAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(amount < 0.01 ? 6 : 2)}`;
}
