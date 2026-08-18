import { describe, expect, it } from 'vitest';
import {
  aggregateDailyUsage,
  aggregateUsageByModel,
  createLocalDateRange,
  formatTokenAxisValue,
  getUsageRetentionStartDate,
  getTokenAxisScale,
  shouldDeleteUsageRecord,
} from '@/src/core/usage-history';

describe('usage history', () => {
  it('aggregates providers and currencies while filling missing local dates', () => {
    const points = aggregateDailyUsage([
      { date: '2026-08-16', inputTokens: 1_200, outputTokens: 300, estimatedCalls: 0 },
      { date: '2026-08-16', inputTokens: 800, outputTokens: 200, estimatedCalls: 1 },
      { date: '2026-08-18', inputTokens: 500, outputTokens: 100, estimatedCalls: 0 },
      { date: '2026-07-01', inputTokens: 999, outputTokens: 999, estimatedCalls: 0 },
    ], '2026-08-18', 3);

    expect(points).toEqual([
      { date: '2026-08-16', inputTokens: 2_000, outputTokens: 500, hasEstimatedUsage: true },
      { date: '2026-08-17', inputTokens: 0, outputTokens: 0, hasEstimatedUsage: false },
      { date: '2026-08-18', inputTokens: 500, outputTokens: 100, hasEstimatedUsage: false },
    ]);
  });

  it('creates a range across month boundaries using local calendar dates', () => {
    expect(createLocalDateRange('2026-03-01', 3)).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
    ]);
  });

  it('keeps daily usage separated by model and orders series by total usage', () => {
    const series = aggregateUsageByModel([
      {
        date: '2026-08-17',
        provider: 'openai-compatible',
        model: 'qwen-plus',
        inputTokens: 100,
        outputTokens: 40,
        estimatedCalls: 0,
      },
      {
        date: '2026-08-18',
        provider: 'openai-compatible',
        model: 'qwen-plus',
        inputTokens: 50,
        outputTokens: 20,
        estimatedCalls: 0,
      },
      {
        date: '2026-08-18',
        provider: 'openai-compatible',
        model: 'qwen-turbo',
        inputTokens: 20,
        outputTokens: 5,
        estimatedCalls: 0,
      },
    ], '2026-08-18', 2);

    expect(series.map(({ model }) => model)).toEqual(['qwen-plus', 'qwen-turbo']);
    expect(series[0]).toMatchObject({
      totalInputTokens: 150,
      totalOutputTokens: 60,
      points: [
        { date: '2026-08-17', inputTokens: 100, outputTokens: 40 },
        { date: '2026-08-18', inputTokens: 50, outputTokens: 20 },
      ],
    });
    expect(series[1]?.points[0]).toMatchObject({ inputTokens: 0, outputTokens: 0 });
  });

  it('keeps a rolling 60-local-day window and removes legacy estimated aggregates', () => {
    expect(getUsageRetentionStartDate('2026-08-18', 60)).toBe('2026-06-20');
    expect(shouldDeleteUsageRecord(
      { date: '2026-06-19', estimatedCalls: 0 },
      '2026-06-20',
    )).toBe(true);
    expect(shouldDeleteUsageRecord(
      { date: '2026-06-20', estimatedCalls: 0 },
      '2026-06-20',
    )).toBe(false);
    expect(shouldDeleteUsageRecord(
      { date: '2026-08-18', estimatedCalls: 1 },
      '2026-06-20',
    )).toBe(true);
  });

  it('selects one compact Y-axis unit from the largest visible value', () => {
    expect(getTokenAxisScale([0, 999]).suffix).toBe('');
    const thousands = getTokenAxisScale([1_200, 25_000]);
    expect(thousands).toMatchObject({ divisor: 1_000, suffix: 'K' });
    expect(formatTokenAxisValue(1_250, thousands)).toBe('1.3');
    expect(getTokenAxisScale([2_500_000]).suffix).toBe('M');
    expect(getTokenAxisScale([1_500_000_000]).suffix).toBe('B');
  });

  it('rejects invalid date windows', () => {
    expect(() => createLocalDateRange('2026-02-30', 30)).toThrow('本地日期无效');
    expect(() => createLocalDateRange('2026-08-18', 0)).toThrow('1 到 90');
  });
});
