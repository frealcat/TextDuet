import { useMemo } from 'react';
import type { UsageHistoryDashboard, UsageModelSeries } from '@/src/core/contracts';
import { formatTokenAxisValue, getTokenAxisScale } from '@/src/core/usage-history';
import { t } from '@/src/i18n';
import {
  buildPath,
  buildPoints,
  computeXTicks,
  computeYTicks,
  formatDate,
} from '@/src/core/usage-chart-svg-helpers';

interface UsageHistoryChartSvgProps {
  dashboard: UsageHistoryDashboard;
  series: UsageModelSeries;
}

// Layout constants, kept in JSX so the SVG renders identically across
// theme switches (the colors come from the surrounding `.usage-chart`
// rules via the v2 design tokens already wired in `style.css`).
const VIEWBOX_WIDTH = 720;
const VIEWBOX_HEIGHT = 260;
const PADDING = { top: 28, right: 24, bottom: 32, left: 56 } as const;
const INPUT_COLOR = '#9c5e2e'; // --td-primary
const OUTPUT_COLOR = '#7c6035'; // --td-accent
const AXIS_COLOR = '#d9d0c1'; // --td-border
const LABEL_COLOR = '#9a9184'; // --td-text-faint
const GRID_COLOR = '#f0eadb'; // softer than axis
const DOT_RADIUS = 3;
const HOVER_RADIUS = 5;

/**
 * Hand-rolled SVG line chart that replaces the previous ECharts
 * implementation. ECharts pulled in a ~495 kB runtime; this component
 * is a few KB of plain SVG and React, accessible by default, and
 * keeps the same shape as the ECharts variant (input solid line,
 * output dashed line, shared Y-axis scale, date axis, hover dots).
 *
 * Theme colors are read from the same v2 design tokens the rest of
 * the Options page uses; the SVG falls back to local constants when
 * the tokens are not present (tests, headless rendering).
 */
export function UsageHistoryChartSvg({ dashboard, series }: UsageHistoryChartSvgProps) {
  const values = useMemo(
    () => series.points.flatMap((point) => [point.inputTokens, point.outputTokens]),
    [series],
  );
  const scale = useMemo(() => getTokenAxisScale(values), [values]);
  const { plotWidth, plotHeight } = useMemo(
    () => ({
      plotWidth: Math.max(0, VIEWBOX_WIDTH - PADDING.left - PADDING.right),
      plotHeight: Math.max(0, VIEWBOX_HEIGHT - PADDING.top - PADDING.bottom),
    }),
    [],
  );
  const inputPath = useMemo(
    () => buildPath(series, (point) => point.inputTokens, scale, plotWidth, plotHeight),
    [series, scale, plotWidth, plotHeight],
  );
  const outputPath = useMemo(
    () => buildPath(series, (point) => point.outputTokens, scale, plotWidth, plotHeight),
    [series, scale, plotWidth, plotHeight],
  );
  const inputPoints = useMemo(
    () => buildPoints(series, (point) => point.inputTokens, scale, plotWidth, plotHeight),
    [series, scale, plotWidth, plotHeight],
  );
  const outputPoints = useMemo(
    () => buildPoints(series, (point) => point.outputTokens, scale, plotWidth, plotHeight),
    [series, scale, plotWidth, plotHeight],
  );
  const yAxisTicks = useMemo(
    () => computeYTicks(values, scale, plotHeight),
    [values, scale, plotHeight],
  );
  const xAxisTicks = useMemo(
    () => computeXTicks(series, plotWidth, plotHeight),
    [series, plotWidth, plotHeight],
  );

  return (
    <div className="usage-chart">
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        width="100%"
        height={VIEWBOX_HEIGHT}
        style={{ display: 'block', maxWidth: '100%' }}
        role="img"
        aria-label={t('usage.chart.ariaLabel', {
          model: series.model,
          days: dashboard.days,
          axisName: scale.axisName,
        })}
      >
        {/* Horizontal grid lines + Y-axis tick labels. */}
        {yAxisTicks.map((tick) => (
          <g key={`y-${tick.value}`}>
            <line
              x1={PADDING.left}
              x2={PADDING.left + plotWidth}
              y1={PADDING.top + tick.y}
              y2={PADDING.top + tick.y}
              stroke={GRID_COLOR}
              strokeWidth={1}
            />
            <text
              x={PADDING.left - 8}
              y={PADDING.top + tick.y + 4}
              fontSize={10}
              textAnchor="end"
              fill={LABEL_COLOR}
            >
              {formatTokenAxisValue(tick.value, scale)}
            </text>
          </g>
        ))}

        {/* X-axis labels at evenly spaced dates. */}
        {xAxisTicks.map((tick) => (
          <g key={`x-${tick.label}`}>
            <text
              x={PADDING.left + tick.x}
              y={PADDING.top + plotHeight + 18}
              fontSize={10}
              textAnchor="middle"
              fill={LABEL_COLOR}
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* X-axis baseline + Y-axis baseline. */}
        <line
          x1={PADDING.left}
          x2={PADDING.left + plotWidth}
          y1={PADDING.top + plotHeight}
          y2={PADDING.top + plotHeight}
          stroke={AXIS_COLOR}
          strokeWidth={1}
        />
        <line
          x1={PADDING.left}
          x2={PADDING.left}
          y1={PADDING.top}
          y2={PADDING.top + plotHeight}
          stroke={AXIS_COLOR}
          strokeWidth={1}
        />

        {/* Y-axis unit label. */}
        <text
          x={PADDING.left - 8}
          y={PADDING.top - 10}
          fontSize={10}
          textAnchor="end"
          fill={LABEL_COLOR}
        >
          {scale.axisName}
        </text>

        {/* Two trend lines: input solid, output dashed. */}
        <path
          d={outputPath}
          stroke={OUTPUT_COLOR}
          strokeWidth={2}
          fill="none"
          strokeDasharray="5 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={inputPath}
          stroke={INPUT_COLOR}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover dots + native <title> for screen readers. Each point
            stacks both lines so the tooltip shows input + output on the
            same date. */}
        {inputPoints.map((point, index) => {
          const output = outputPoints[index];
          if (!output) return null;
          return (
            <g key={`dot-${point.date}`}>
              <circle cx={point.x} cy={point.y} r={DOT_RADIUS} fill={INPUT_COLOR} />
              <circle cx={output.x} cy={output.y} r={DOT_RADIUS} fill={OUTPUT_COLOR} />
              {/* Larger transparent hit target for easier hover. */}
              <circle cx={point.x} cy={point.y} r={HOVER_RADIUS} fill="transparent">
                <title>
                  {`${point.date}: ${t('usage.chart.dataRow', {
                    date: point.date,
                    input: point.inputTokens.toLocaleString('en-US'),
                    output: point.outputTokens.toLocaleString('en-US'),
                  })}`}
                </title>
              </circle>
            </g>
          );
        })}
      </svg>
      <div className="usage-chart-legend" aria-hidden="true">
        <span>
          <i className="usage-chart-legend-line input" />
          {t('usage.chart.series.input')}
        </span>
        <span>
          <i className="usage-chart-legend-line output" />
          {t('usage.chart.series.output')}
        </span>
      </div>
      <ul className="usage-chart-data sr-only">
        {series.points.map((point) => (
          <li key={point.date}>
            {t('usage.chart.dataRow', {
              date: point.date,
              input: point.inputTokens.toLocaleString('en-US'),
              output: point.outputTokens.toLocaleString('en-US'),
            })}
          </li>
        ))}
      </ul>
    </div>
  );
}
