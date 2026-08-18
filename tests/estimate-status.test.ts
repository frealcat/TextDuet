import { describe, expect, it } from 'vitest';
import type { TranslationEstimateResponse } from '@/src/core/contracts';
import {
  describeUsageRecording,
  summarizePageEstimates,
} from '@/src/translator/estimate-status';

const baseEstimate: TranslationEstimateResponse = {
  estimate: {
    inputTokens: 100,
    outputTokensMin: 50,
    outputTokensMax: 80,
    currency: 'USD',
    costMin: 0.001,
    costMax: 0.002,
    isPriceConfigured: true,
  },
  today: {
    date: '2026-08-17',
    currency: 'USD',
    inputTokens: 0,
    outputTokens: 0,
    actualCost: 0,
    estimatedCost: 0,
    totalCost: 0,
    hasActualUsage: false,
    hasEstimatedUsage: false,
    budgetEnabled: false,
    dailyBudget: 0,
    budgetPercentage: 0,
    notifiedThresholds: [],
  },
  isLedgerAvailable: true,
  cache: { hitCount: 0, missCount: 2, isAvailable: true },
};

describe('page estimate status', () => {
  it('describes a full hit without reporting an irrelevant ledger failure', () => {
    const summary = summarizePageEstimates([
      {
        ...baseEstimate,
        estimate: {
          ...baseEstimate.estimate,
          inputTokens: 0,
          outputTokensMin: 0,
          outputTokensMax: 0,
          costMin: 0,
          costMax: 0,
        },
        isLedgerAvailable: false,
        cache: { hitCount: 2, missCount: 0, isAvailable: true },
      },
    ], 2);

    expect(summary.message).toBe('本次 2 段预计全部命中本地缓存，不会调用模型');
    expect(summary.isLedgerAvailable).toBe(true);
  });

  it('includes partial cache hits and preserves ledger failures for paid misses', () => {
    const summary = summarizePageEstimates([
      {
        ...baseEstimate,
        isLedgerAvailable: false,
        cache: { hitCount: 1, missCount: 1, isAvailable: true },
      },
    ], 2);

    expect(summary.message).toContain('预计缓存命中 1/2 段');
    expect(summary.isLedgerAvailable).toBe(false);
  });

  it('distinguishes missing Provider usage from an actual ledger write failure', () => {
    expect(describeUsageRecording([
      { usageKind: 'estimated', isLedgerRecorded: false },
    ])).toContain('未计入 Token 历史');
    expect(describeUsageRecording([
      { usageKind: 'actual', isLedgerRecorded: false },
    ])).toContain('实际用量未能写入本地账本');
    expect(describeUsageRecording([
      { usageKind: 'cached', isLedgerRecorded: true },
      { usageKind: 'actual', isLedgerRecorded: true },
    ])).toBe('');
  });
});
