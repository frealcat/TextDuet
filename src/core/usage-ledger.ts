import type { CostSettings, ModelUsage, TodayUsageSummary } from './contracts';

export interface UsageAggregateRecord {
  key: string;
  date: string;
  dateCurrency: string;
  provider: 'openai-compatible';
  model: string;
  currency: 'USD' | 'CNY' | 'EUR';
  inputTokens: number;
  outputTokens: number;
  actualCost: number;
  estimatedCost: number;
  actualCalls: number;
  estimatedCalls: number;
}

export interface UsageAggregateEntry {
  date: string;
  provider: 'openai-compatible';
  model: string;
  currency: 'USD' | 'CNY' | 'EUR';
  usage: ModelUsage;
  amount: number;
  isEstimate: boolean;
}

export function updateUsageAggregate(
  existing: UsageAggregateRecord | undefined,
  entry: UsageAggregateEntry,
  key: string,
  dateCurrency: string,
): UsageAggregateRecord {
  const record: UsageAggregateRecord = existing || {
    key,
    date: entry.date,
    dateCurrency,
    provider: entry.provider,
    model: entry.model,
    currency: entry.currency,
    inputTokens: 0,
    outputTokens: 0,
    actualCost: 0,
    estimatedCost: 0,
    actualCalls: 0,
    estimatedCalls: 0,
  };

  return {
    ...record,
    inputTokens: record.inputTokens + entry.usage.inputTokens,
    outputTokens: record.outputTokens + entry.usage.outputTokens,
    actualCost: record.actualCost + (entry.isEstimate ? 0 : entry.amount),
    estimatedCost: record.estimatedCost + (entry.isEstimate ? entry.amount : 0),
    actualCalls: record.actualCalls + (entry.isEstimate ? 0 : 1),
    estimatedCalls: record.estimatedCalls + (entry.isEstimate ? 1 : 0),
  };
}

export function summarizeUsageRecords(
  date: string,
  currency: UsageAggregateEntry['currency'],
  records: UsageAggregateRecord[],
  budget: CostSettings['budget'],
  notifiedThresholds: Array<50 | 80 | 100>,
): TodayUsageSummary {
  const inputTokens = records.reduce((sum, record) => sum + record.inputTokens, 0);
  const outputTokens = records.reduce((sum, record) => sum + record.outputTokens, 0);
  const actualCost = records.reduce((sum, record) => sum + record.actualCost, 0);
  const estimatedCost = records.reduce((sum, record) => sum + record.estimatedCost, 0);
  const totalCost = actualCost + estimatedCost;

  return {
    date,
    currency,
    inputTokens,
    outputTokens,
    actualCost,
    estimatedCost,
    totalCost,
    hasActualUsage: records.some((record) => record.actualCalls > 0),
    hasEstimatedUsage: records.some((record) => record.estimatedCalls > 0),
    budgetEnabled: budget.enabled,
    dailyBudget: budget.enabled ? budget.dailyLimit : 0,
    budgetPercentage:
      budget.enabled && budget.dailyLimit > 0
        ? Math.min((totalCost / budget.dailyLimit) * 100, 1_000_000_000)
        : 0,
    notifiedThresholds,
  };
}
