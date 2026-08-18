import type { UsageHistoryPoint, UsageModelSeries } from './contracts';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1_000;

export interface DailyUsageRecord {
  date: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCalls: number;
}

export interface ModelDailyUsageRecord extends DailyUsageRecord {
  provider: 'openai-compatible';
  model: string;
}

export interface RetainedUsageRecord {
  date: string;
  estimatedCalls: number;
}

export interface TokenAxisScale {
  divisor: number;
  suffix: '' | 'K' | 'M' | 'B';
  axisName: string;
}

/** Builds a gap-free local-calendar series ending on the supplied local date. */
export function aggregateDailyUsage(
  records: readonly DailyUsageRecord[],
  endDate: string,
  days: number,
): UsageHistoryPoint[] {
  const dates = createLocalDateRange(endDate, days);
  const dateSet = new Set(dates);
  const totals = new Map<string, UsageHistoryPoint>();

  for (const record of records) {
    if (!dateSet.has(record.date)) continue;
    const current = totals.get(record.date) || {
      date: record.date,
      inputTokens: 0,
      outputTokens: 0,
      hasEstimatedUsage: false,
    };
    current.inputTokens += record.inputTokens;
    current.outputTokens += record.outputTokens;
    current.hasEstimatedUsage ||= record.estimatedCalls > 0;
    totals.set(record.date, current);
  }

  return dates.map((date) => totals.get(date) || {
    date,
    inputTokens: 0,
    outputTokens: 0,
    hasEstimatedUsage: false,
  });
}

/** Keeps provider/model identity while producing gap-free daily series. */
export function aggregateUsageByModel(
  records: readonly ModelDailyUsageRecord[],
  endDate: string,
  days: number,
): UsageModelSeries[] {
  const grouped = new Map<string, ModelDailyUsageRecord[]>();
  for (const record of records) {
    const key = `${record.provider}\u0000${record.model}`;
    const group = grouped.get(key) || [];
    group.push(record);
    grouped.set(key, group);
  }

  return [...grouped.values()]
    .flatMap((group) => {
      const first = group[0];
      if (!first) return [];
      const points = aggregateDailyUsage(group, endDate, days);
      return [{
        provider: first.provider,
        model: first.model,
        points,
        totalInputTokens: points.reduce((sum, point) => sum + point.inputTokens, 0),
        totalOutputTokens: points.reduce((sum, point) => sum + point.outputTokens, 0),
        hasEstimatedUsage: points.some((point) => point.hasEstimatedUsage),
      } satisfies UsageModelSeries];
    })
    .sort((left, right) => {
      const usageDifference = right.totalInputTokens + right.totalOutputTokens
        - left.totalInputTokens - left.totalOutputTokens;
      return usageDifference || left.model.localeCompare(right.model);
    });
}

export function createLocalDateRange(endDate: string, days: number): string[] {
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    throw new Error('用量历史天数必须在 1 到 90 之间');
  }
  const end = parseLocalDate(endDate);
  return Array.from({ length: days }, (_, index) => {
    const offset = index - days + 1;
    return formatLocalDate(new Date(end.getTime() + offset * DAY_IN_MILLISECONDS));
  });
}

export function getUsageRetentionStartDate(endDate: string, days: number): string {
  const [startDate] = createLocalDateRange(endDate, days);
  if (!startDate) throw new Error('用量保留周期无效');
  return startDate;
}

/** Removes data outside retention and legacy aggregates that mixed estimates into token totals. */
export function shouldDeleteUsageRecord(
  record: RetainedUsageRecord,
  retentionStartDate: string,
): boolean {
  return record.date < retentionStartDate || record.estimatedCalls > 0;
}

/** Chooses one stable unit for the complete Y axis so lines remain comparable. */
export function getTokenAxisScale(values: readonly number[]): TokenAxisScale {
  const maximum = Math.max(0, ...values.filter(Number.isFinite));
  if (maximum >= 1_000_000_000) return { divisor: 1_000_000_000, suffix: 'B', axisName: 'B token' };
  if (maximum >= 1_000_000) return { divisor: 1_000_000, suffix: 'M', axisName: 'M token' };
  if (maximum >= 1_000) return { divisor: 1_000, suffix: 'K', axisName: 'K token' };
  return { divisor: 1, suffix: '', axisName: 'token' };
}

export function formatTokenAxisValue(value: number, scale: TokenAxisScale): string {
  const scaled = value / scale.divisor;
  if (scale.divisor === 1) return Math.round(scaled).toLocaleString('en-US');
  return scaled.toLocaleString('en-US', {
    maximumFractionDigits: scaled < 10 ? 1 : 0,
  });
}

function parseLocalDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('本地日期格式无效');
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  if (formatLocalDate(date) !== value) throw new Error('本地日期无效');
  return date;
}

function formatLocalDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
