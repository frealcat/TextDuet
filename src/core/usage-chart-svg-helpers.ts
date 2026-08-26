/**
 * Pure helpers for the hand-rolled SVG line chart that replaces the
 * old ECharts implementation. Extracted from
 * `entrypoints/options/UsageHistoryChartSvg.tsx` so they can be
 * unit-tested without a React renderer; the component just composes
 * these primitives.
 */

import type { UsageModelSeries } from './contracts';
import { getTokenAxisScale } from './usage-history';

export interface ChartPoint {
  date: string;
  x: number;
  y: number;
  inputTokens: number;
  outputTokens: number;
}

export interface AxisTick {
  value: number;
  y: number;
}

export interface XAxisTick {
  label: string;
  x: number;
}

export function buildPoints(
  series: UsageModelSeries,
  pick: (point: UsageModelSeries['points'][number]) => number,
  scale: ReturnType<typeof getTokenAxisScale>,
  plotWidth: number,
  plotHeight: number,
): ChartPoint[] {
  const count = series.points.length;
  if (count === 0 || plotWidth === 0 || plotHeight === 0) return [];
  const xFor = (index: number): number =>
    count === 1 ? plotWidth / 2 : (plotWidth * index) / (count - 1);
  // Normalize against the largest point in the series so the peak
  // value lands at y=0 (the top) and zero / missing values land at
  // y=plotHeight (the bottom). Without this max-pre-pass, a per-row
  // yFor divides by the current value and produces NaN for zeros.
  const maxScaled = Math.max(
    0,
    ...series.points.map((point) => pick(point) / (scale.divisor || 1)),
  );
  // Treat values that round to zero as zero. `Math.sin(π)` returns
  // a tiny ~1e-16 residual, and `10000 * 1e-16` still yanks the
  // y coordinate to ~199.999. Snap to either the top (peak) or the
  // bottom (zero) of the plot so a zero/peak point lands on the
  // exact gridline.
  const yFor = (value: number): number => {
    if (scale.divisor === 0) return plotHeight;
    const scaled = value / scale.divisor;
    if (!Number.isFinite(scaled) || maxScaled === 0) return plotHeight;
    if (Math.abs(scaled) < 1e-9) return plotHeight;
    if (Math.abs(scaled - maxScaled) < 1e-9) return 0;
    return plotHeight - (plotHeight * scaled) / maxScaled;
  };
  return series.points.map((point, index) => ({
    date: point.date,
    x: xFor(index),
    y: yFor(pick(point)),
    inputTokens: point.inputTokens,
    outputTokens: point.outputTokens,
  }));
}

export function buildPath(
  series: UsageModelSeries,
  pick: (point: UsageModelSeries['points'][number]) => number,
  scale: ReturnType<typeof getTokenAxisScale>,
  plotWidth: number,
  plotHeight: number,
): string {
  const points = buildPoints(series, pick, scale, plotWidth, plotHeight);
  if (points.length === 0) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

export function computeYTicks(
  values: readonly number[],
  scale: ReturnType<typeof getTokenAxisScale>,
  plotHeight: number,
): AxisTick[] {
  if (values.length === 0 || plotHeight === 0) return [];
  const maximum = Math.max(...values, 0) / scale.divisor;
  if (maximum <= 0) return [];
  const step = niceStep(maximum, 4);
  const tickCount = Math.min(5, Math.max(2, Math.floor(maximum / step) + 1));
  return Array.from({ length: tickCount }, (_, index) => {
    const value = step * index;
    const y = plotHeight - (plotHeight * value) / maximum;
    return { value, y };
  });
}

export function niceStep(maximum: number, target: number): number {
  if (maximum <= 0) return 1;
  const rough = maximum / target;
  const exponent = Math.floor(Math.log10(rough));
  const fraction = rough / Math.pow(10, exponent);
  let nice: number;
  if (fraction < 1.5) nice = 1;
  else if (fraction < 3) nice = 2;
  else if (fraction < 7) nice = 5;
  else nice = 10;
  return nice * Math.pow(10, exponent);
}

export function computeXTicks(
  series: UsageModelSeries,
  plotWidth: number,
  _plotHeight: number,
): XAxisTick[] {
  if (series.points.length === 0 || plotWidth === 0) return [];
  const target = Math.min(6, series.points.length);
  if (target === 1) {
    const first = series.points[0];
    if (!first) return [];
    return [{ label: formatDate(first.date), x: plotWidth / 2 }];
  }
  return Array.from({ length: target }, (_, index) => {
    const sourceIndex = Math.round((index * (series.points.length - 1)) / (target - 1));
    const point = series.points[sourceIndex];
    if (!point) return { label: '', x: 0 };
    const x = (plotWidth * sourceIndex) / (series.points.length - 1);
    return { label: formatDate(point.date), x };
  }).filter((tick) => tick.label !== '');
}

export function formatDate(iso: string): string {
  // Only collapse the YYYY-MM-DD canonical form to MM-DD; anything
  // else (shorter, malformed, or non-ISO) is returned as-is so a
  // stray date does not show up as a weird suffix.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${match[2]}-${match[3]}`;
}
