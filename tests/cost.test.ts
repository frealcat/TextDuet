import { describe, expect, it } from 'vitest';
import type { CostPrice, CostSettings, TranslationBatchRequest } from '@/src/core/contracts';
import {
  calculateUsageCost,
  effectivePriceForModel,
  estimateTextTokens,
  estimateTranslationCost,
  evaluateBudgetThresholds,
  getLocalDateKey,
  settleUsage,
} from '@/src/core/cost';
import { summarizeUsageRecords, updateUsageAggregate } from '@/src/core/usage-ledger';

const price: CostPrice = {
  enabled: true,
  model: 'example-model',
  currency: 'USD',
  inputPerMillion: 2,
  outputPerMillion: 8,
  updatedAt: '2026-08-14',
  source: 'user',
};

const budget: CostSettings['budget'] = {
  enabled: true,
  dailyLimit: 10,
};

const request: TranslationBatchRequest = {
  sourceLanguage: 'auto',
  targetLanguage: 'zh-CN',
  blocks: [{ id: 'block-1', text: 'A deterministic source paragraph.' }],
};

describe('cost estimation', () => {
  it('uses a deterministic CJK-aware token approximation', () => {
    expect(estimateTextTokens('abcdefgh')).toBe(2);
    expect(estimateTextTokens('中文测试')).toBe(4);
    expect(estimateTextTokens('')).toBe(1);
  });

  it('returns an output and cost interval instead of a false exact value', () => {
    const estimate = estimateTranslationCost(request, 'Translate safely.', price);

    expect(estimate.inputTokens).toBeGreaterThan(0);
    expect(estimate.outputTokensMax).toBeGreaterThan(estimate.outputTokensMin);
    expect(estimate.costMax).toBeGreaterThan(estimate.costMin);
    expect(estimate.isPriceConfigured).toBe(true);
  });

  it('calculates fixed usage prices per million tokens', () => {
    expect(calculateUsageCost(1_000_000, 500_000, price)).toBe(6);
  });

  it('prefers actual Provider usage and otherwise records the estimate upper bound', () => {
    const estimate = estimateTranslationCost(request, 'Translate safely.', price);
    const actual = settleUsage(
      { inputTokens: 100, outputTokens: 50, kind: 'actual' },
      estimate,
      price,
    );
    const estimated = settleUsage(undefined, estimate, price);

    expect(actual).toEqual({
      usage: { inputTokens: 100, outputTokens: 50, kind: 'actual' },
      amount: 0.0006,
      isEstimate: false,
    });
    expect(estimated.usage.kind).toBe('estimated');
    expect(estimated.usage.outputTokens).toBe(estimate.outputTokensMax);
    expect(estimated.amount).toBe(estimate.costMax);
  });

  it('disables a saved price when the current model no longer matches', () => {
    expect(effectivePriceForModel(price, 'another-model').enabled).toBe(false);
    expect(effectivePriceForModel(price, 'example-model')).toBe(price);
  });
});

describe('daily budget policy', () => {
  it('emits 50, 80 and 100 percent only when each threshold is crossed', () => {
    const first = evaluateBudgetThresholds(8.5, budget, []);
    expect(first.crossedThresholds).toEqual([50, 80]);

    const second = evaluateBudgetThresholds(11, budget, first.notifiedThresholds);
    expect(second.crossedThresholds).toEqual([100]);

    const repeated = evaluateBudgetThresholds(12, budget, second.notifiedThresholds);
    expect(repeated.crossedThresholds).toEqual([]);
  });

  it('does not emit reminders while the budget is disabled', () => {
    expect(
      evaluateBudgetThresholds(100, { enabled: false, dailyLimit: 0 }, []),
    ).toEqual({ crossedThresholds: [], notifiedThresholds: [] });
  });

  it('emits missing reminders on the next record after a budget is enabled mid-day', () => {
    expect(evaluateBudgetThresholds(9.5, budget, []).crossedThresholds).toEqual([50, 80]);
  });

  it('uses the local calendar date so a new day gets a distinct ledger key', () => {
    expect(getLocalDateKey(new Date(2026, 7, 14, 23, 59))).toBe('2026-08-14');
    expect(getLocalDateKey(new Date(2026, 7, 15, 0, 1))).toBe('2026-08-15');
  });
});

describe('daily usage aggregation', () => {
  it('keeps actual and estimated costs distinct while aggregating tokens', () => {
    const key = '2026-08-14:USD:openai-compatible:example-model';
    const actual = updateUsageAggregate(
      undefined,
      {
        date: '2026-08-14',
        provider: 'openai-compatible',
        model: 'example-model',
        currency: 'USD',
        usage: { inputTokens: 100, outputTokens: 50, kind: 'actual' },
        amount: 1.25,
        isEstimate: false,
      },
      key,
      '2026-08-14:USD',
    );
    const combined = updateUsageAggregate(
      actual,
      {
        date: '2026-08-14',
        provider: 'openai-compatible',
        model: 'example-model',
        currency: 'USD',
        usage: { inputTokens: 80, outputTokens: 40, kind: 'estimated' },
        amount: 0.75,
        isEstimate: true,
      },
      key,
      '2026-08-14:USD',
    );
    const summary = summarizeUsageRecords('2026-08-14', 'USD', [combined], budget, [50]);

    expect(summary).toMatchObject({
      inputTokens: 180,
      outputTokens: 90,
      actualCost: 1.25,
      estimatedCost: 0.75,
      totalCost: 2,
      hasActualUsage: true,
      hasEstimatedUsage: true,
      notifiedThresholds: [50],
    });
  });

  it('starts a fresh summary when the local date changes', () => {
    const summary = summarizeUsageRecords('2026-08-15', 'USD', [], budget, []);
    expect(summary).toMatchObject({
      date: '2026-08-15',
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0,
      notifiedThresholds: [],
    });
  });
});
