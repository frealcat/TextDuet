import { describe, expect, it } from 'vitest';
import {
  buildPath,
  buildPoints,
  computeXTicks,
  computeYTicks,
  formatDate,
  niceStep,
} from '@/src/core/usage-chart-svg-helpers';
import { getTokenAxisScale } from '@/src/core/usage-history';
import type { UsageModelSeries } from '@/src/core/contracts';

function makeSeries(count: number, peak = 10_000): UsageModelSeries {
  const points = Array.from({ length: count }, (_, index) => ({
    date: `2026-08-${String(index + 1).padStart(2, '0')}`,
    inputTokens: peak * Math.sin((index / Math.max(count - 1, 1)) * Math.PI),
    outputTokens: peak * 0.5 * Math.cos((index / Math.max(count - 1, 1)) * Math.PI),
    hasEstimatedUsage: false,
  }));
  return {
    provider: 'openai-compatible',
    model: 'test-model',
    points,
    totalInputTokens: points.reduce((sum, point) => sum + point.inputTokens, 0),
    totalOutputTokens: points.reduce((sum, point) => sum + point.outputTokens, 0),
    hasEstimatedUsage: false,
  };
}

describe('buildPath / buildPoints', () => {
  it('produces an M-then-L path with one segment per pair', () => {
    const series = makeSeries(3);
    const scale = getTokenAxisScale(series.points.map((p) => p.inputTokens));
    const path = buildPath(series, (point) => point.inputTokens, scale, 600, 200);
    const segments = path.split(' ');
    expect(segments[0]).toBe('M');
    expect(segments.filter((segment) => segment === 'L')).toHaveLength(2);
  });

  it('builds one point per data row with x spread across the plot width', () => {
    const series = makeSeries(4);
    const scale = getTokenAxisScale(series.points.map((p) => p.inputTokens));
    const points = buildPoints(series, (point) => point.inputTokens, scale, 600, 200);
    expect(points).toHaveLength(4);
    expect(points[0]?.x).toBe(0);
    expect(points.at(-1)?.x).toBe(600);
    // Endpoints of a half-sine sit at the bottom of the plot
    // (inputTokens=0 → y=plotHeight=200). The interior points are
    // strictly above the baseline.
    expect(points[0]?.y).toBe(200);
    expect(points.at(-1)?.y).toBe(200);
    for (const point of points.slice(1, -1)) {
      expect(point.y).toBeLessThan(200);
    }
  });

  it('returns an empty string / array for a zero-width plot', () => {
    const series = makeSeries(3);
    const scale = getTokenAxisScale(series.points.map((p) => p.inputTokens));
    expect(buildPath(series, (point) => point.inputTokens, scale, 0, 200)).toBe('');
    expect(buildPoints(series, (point) => point.inputTokens, scale, 0, 200)).toEqual([]);
  });
});

describe('computeYTicks', () => {
  it('returns an empty list when there is no data', () => {
    expect(computeYTicks([], getTokenAxisScale([0]), 200)).toEqual([]);
    expect(computeYTicks([0, 0, 0], getTokenAxisScale([0]), 0)).toEqual([]);
  });

  it('clamps to at most 5 ticks for visual readability', () => {
    const values = Array.from({ length: 1000 }, () => Math.random() * 1_000_000);
    const ticks = computeYTicks(values, getTokenAxisScale(values), 200);
    expect(ticks.length).toBeLessThanOrEqual(5);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
  });
});

describe('computeXTicks', () => {
  it('uses MM-DD labels (drops the year) so the axis stays compact', () => {
    const series = makeSeries(7);
    const ticks = computeXTicks(series, 600, 200);
    expect(ticks.length).toBe(6);
    expect(ticks[0]?.label).toMatch(/^\d{2}-\d{2}$/);
    expect(ticks[0]?.label).toBe('08-01');
  });

  it('handles a single data point without dividing by zero', () => {
    const series = makeSeries(1);
    const ticks = computeXTicks(series, 600, 200);
    expect(ticks).toHaveLength(1);
    expect(ticks[0]?.x).toBe(300);
  });
});

describe('formatDate / niceStep', () => {
  it('returns the original string when not in YYYY-MM-DD format', () => {
    expect(formatDate('not a date')).toBe('not a date');
    expect(formatDate('2026-8-1')).toBe('2026-8-1');
  });

  it('picks a nice round step in the 1-2-5-10 series', () => {
    expect(niceStep(0, 4)).toBe(1);
    expect(niceStep(100, 4)).toBe(20);
    expect(niceStep(50, 4)).toBe(10);
    expect(niceStep(20, 4)).toBe(5);
    expect(niceStep(1000, 4)).toBe(200);
  });
});
