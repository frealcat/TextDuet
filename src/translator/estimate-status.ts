import type { ModelUsage, TranslationEstimateResponse } from '@/src/core/contracts';
import { formatMoneyAmount } from '@/src/core/cost';

export interface PageEstimateSummary {
  message: string;
  currency: string;
  isPriceConfigured: boolean;
  todayTotalCost: number;
  isLedgerAvailable: boolean;
  isCacheAvailable: boolean;
}

export interface UsageRecordingStatus {
  usageKind: ModelUsage['kind'];
  isLedgerRecorded: boolean;
}

export function summarizePageEstimates(
  estimates: readonly TranslationEstimateResponse[],
  blockCount: number,
): PageEstimateSummary {
  const total = estimates.reduce(
    (summary, response) => ({
      inputTokens: summary.inputTokens + response.estimate.inputTokens,
      outputTokensMin: summary.outputTokensMin + response.estimate.outputTokensMin,
      outputTokensMax: summary.outputTokensMax + response.estimate.outputTokensMax,
      costMin: summary.costMin + response.estimate.costMin,
      costMax: summary.costMax + response.estimate.costMax,
      cacheHitCount: summary.cacheHitCount + response.cache.hitCount,
    }),
    {
      inputTokens: 0,
      outputTokensMin: 0,
      outputTokensMax: 0,
      costMin: 0,
      costMax: 0,
      cacheHitCount: 0,
    },
  );
  const firstEstimate = estimates[0];
  const isPriceConfigured = Boolean(firstEstimate?.estimate.isPriceConfigured);
  const currency = firstEstimate?.estimate.currency || 'USD';
  const cacheMessage = total.cacheHitCount > 0
    ? `；预计缓存命中 ${total.cacheHitCount}/${blockCount} 段`
    : '';
  const message = total.cacheHitCount === blockCount
    ? `本次 ${blockCount} 段预计全部命中本地缓存，不会调用模型`
    : isPriceConfigured
      ? `本次预估：输入 ${total.inputTokens} tokens，输出 ${total.outputTokensMin}–${total.outputTokensMax} tokens，${formatMoneyAmount(total.costMin, currency)}–${formatMoneyAmount(total.costMax, currency)}${cacheMessage}`
      : `本次预估：输入 ${total.inputTokens} tokens，输出 ${total.outputTokensMin}–${total.outputTokensMax} tokens；当前模型尚未配置价格${cacheMessage}`;

  return {
    message,
    currency,
    isPriceConfigured,
    todayTotalCost: firstEstimate?.today.totalCost || 0,
    isLedgerAvailable: estimates.every(
      (estimate) => estimate.cache.missCount === 0 || estimate.isLedgerAvailable,
    ),
    isCacheAvailable: estimates.every((estimate) => estimate.cache.isAvailable),
  };
}

export function describeUsageRecording(
  statuses: readonly UsageRecordingStatus[],
): string {
  const missingUsageMessage = statuses.some(({ usageKind }) => usageKind === 'estimated')
    ? '；Provider 未返回 usage，本次仅估算且未计入 Token 历史'
    : '';
  const ledgerFailureMessage = statuses.some(
    ({ usageKind, isLedgerRecorded }) => usageKind === 'actual' && !isLedgerRecorded,
  )
    ? '；部分实际用量未能写入本地账本'
    : '';
  return `${missingUsageMessage}${ledgerFailureMessage}`;
}
