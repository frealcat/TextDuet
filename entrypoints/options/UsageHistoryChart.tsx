import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import type { ComposeOption } from 'echarts/core';
import { LineChart, type LineSeriesOption } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
  type GridComponentOption,
  type LegendComponentOption,
  type TooltipComponentOption,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { UsageHistoryDashboard, UsageModelSeries } from '@/src/core/contracts';
import { formatTokenAxisValue, getTokenAxisScale } from '@/src/core/usage-history';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

type UsageChartOption = ComposeOption<
  LineSeriesOption | GridComponentOption | LegendComponentOption | TooltipComponentOption
>;

interface UsageHistoryChartProps {
  dashboard: UsageHistoryDashboard;
  series: UsageModelSeries;
}

export function UsageHistoryChart({ dashboard, series }: UsageHistoryChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const values = series.points.flatMap((point) => [point.inputTokens, point.outputTokens]);
  const scale = getTokenAxisScale(values);

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return undefined;

    const chart = echarts.init(element, undefined, { renderer: 'canvas' });
    const option: UsageChartOption = {
      animation: false,
      color: ['#9c5e2e', '#7c6035'],
      grid: { top: 34, right: 16, bottom: 28, left: 48 },
      legend: {
        top: 0,
        right: 0,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: '#6b6356', fontSize: 11 },
      },
      tooltip: {
        trigger: 'axis',
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: series.points.map((point) => point.date.slice(5)),
        axisLine: { lineStyle: { color: '#e8e1d4' } },
        axisTick: { show: false },
        axisLabel: { color: '#9a9184', fontSize: 10, hideOverlap: true },
      },
      yAxis: {
        type: 'value',
        min: 0,
        name: scale.axisName,
        nameTextStyle: { color: '#9a9184', fontSize: 10 },
        splitLine: { lineStyle: { color: '#e8e1d4' } },
        axisLabel: {
          color: '#9a9184',
          fontSize: 10,
          formatter: (value: number) => formatTokenAxisValue(value, scale),
        },
      },
      series: [
        {
          name: '输入',
          type: 'line',
          smooth: 0.18,
          showSymbol: false,
          emphasis: { focus: 'series' },
          lineStyle: { width: 2, type: 'solid' },
          data: series.points.map((point) => point.inputTokens),
        },
        {
          name: '输出',
          type: 'line',
          smooth: 0.18,
          showSymbol: false,
          emphasis: { focus: 'series' },
          lineStyle: { width: 2, type: 'dashed' },
          data: series.points.map((point) => point.outputTokens),
        },
      ],
    };
    chart.setOption(option);

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(element);
    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, [scale, series]);

  return (
    <div className="usage-chart-wrap">
      <div
        ref={chartRef}
        className="usage-chart"
        role="img"
        aria-label={`${series.model} 最近 ${dashboard.days} 天输入和输出 token 用量折线图，纵轴单位为 ${scale.axisName}`}
      />
      <ul className="usage-chart-data sr-only">
        {series.points.map((point) => (
          <li key={point.date}>
            {point.date}：输入 {point.inputTokens.toLocaleString('en-US')}，输出{' '}
            {point.outputTokens.toLocaleString('en-US')} token
          </li>
        ))}
      </ul>
    </div>
  );
}
