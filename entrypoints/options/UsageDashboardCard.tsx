import { lazy, Suspense, useEffect, useState } from 'react';
import { ChartLineIcon, ExternalLinkIcon, RefreshIcon, TrashIcon, CacheIcon } from '@/src/icons';
import type {
  OfficialModelPricing,
  ProviderBalance,
  RuntimeMessage,
  UsageHistoryDashboard,
  UsageModelSeries,
} from '@/src/core/contracts';
import { getOfficialPricingSource } from '@/src/core/pricing-sources';
import {
  parseOfficialModelPricing,
  parseOperationResult,
  parseProviderBalance,
  parseUsageHistoryDashboard,
} from '@/src/core/schemas';
import { useTranslation } from '@/src/i18n';

// Charting is only needed after a local usage history with actual data has
// loaded. Keep it out of the Options startup chunk so opening settings to
// change a provider or API key never has to parse charting code first.
// TD-2026 WS2: the chart is now a hand-rolled SVG component (no ECharts),
// so the lazy chunk is just a few KB of TypeScript instead of ~495 kB of
// charting runtime.
const UsageHistoryChart = lazy(async () => {
  const module = await import('./UsageHistoryChartSvg');
  return { default: module.UsageHistoryChartSvg };
});

interface UsageDashboardCardProps {
  baseUrl: string;
  model: string;
  refreshKey: number;
  /** Optional DOM id, used by sidebar scroll anchors (TD-2026-025 P2). */
  id?: string;
}

export function UsageDashboardCard({ baseUrl, model, refreshKey, id }: UsageDashboardCardProps) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<UsageHistoryDashboard | null>(null);
  const [officialPricing, setOfficialPricing] = useState<OfficialModelPricing>({
    status: 'unavailable',
  });
  const [providerBalance, setProviderBalance] = useState<ProviderBalance>({
    status: 'unsupported',
  });
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [balanceBusy, setBalanceBusy] = useState(false);
  const [selectedModelKey, setSelectedModelKey] = useState('');
  const isDeepSeek = getOfficialPricingSource(baseUrl)?.id === 'deepseek';

  useEffect(() => {
    void refreshHistory();
  }, []);

  useEffect(() => {
    let isCurrent = true;
    setOfficialPricing({ status: 'unavailable' });
    setProviderBalance({ status: 'unsupported' });
    if (!model.trim()) return () => { isCurrent = false; };

    browser.runtime
      .sendMessage({
        type: 'REFRESH_PROVIDER_PRICING',
        baseUrl,
        model,
      } satisfies RuntimeMessage)
      .then((value) => {
        if (isCurrent) setOfficialPricing(parseOfficialModelPricing(value));
      })
      .catch(() => {
        if (isCurrent) setOfficialPricing({ status: 'unavailable' });
      });
    return () => { isCurrent = false; };
  }, [baseUrl, model, refreshKey]);

  async function refreshHistory(): Promise<void> {
    try {
      const rawHistory: unknown = await browser.runtime.sendMessage({
        type: 'GET_USAGE_HISTORY',
      } satisfies RuntimeMessage);
      const parsedHistory = parseUsageHistoryDashboard(rawHistory);
      setHistory(parsedHistory);
      setSelectedModelKey((current) => parsedHistory.models.some(
        (series) => getModelSeriesKey(series) === current,
      ) ? current : getModelSeriesKey(parsedHistory.models[0]));
    } catch {
      setStatus(t('usage.status.readFailed'));
    }
  }

  async function clearLedger(): Promise<void> {
    if (!window.confirm(t('usage.confirm.clear'))) return;
    setBusy(true);
    setStatus('');
    try {
      const rawResult: unknown = await browser.runtime.sendMessage({
        type: 'CLEAR_USAGE_LEDGER',
      } satisfies RuntimeMessage);
      const result = parseOperationResult(rawResult);
      if (!result.ok) throw new Error();
      setStatus(t('usage.status.cleared'));
      await refreshHistory();
    } catch {
      setStatus(t('usage.status.clearFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function refreshBalance(): Promise<void> {
    setBalanceBusy(true);
    setStatus('');
    try {
      const rawBalance: unknown = await browser.runtime.sendMessage({
        type: 'GET_PROVIDER_BALANCE',
      } satisfies RuntimeMessage);
      let balance: ProviderBalance;
      try {
        balance = parseProviderBalance(rawBalance);
      } catch {
        parseOperationResult(rawBalance);
        throw new Error();
      }
      if (balance.status === 'unsupported') {
        setProviderBalance({ status: 'unsupported' });
        setStatus(t('usage.status.balanceConfigRequired'));
        return;
      }
      setProviderBalance(balance);
      setStatus(t('usage.status.balanceUpdated'));
    } catch {
      setProviderBalance({ status: 'unsupported' });
      setStatus(t('usage.status.balanceFailed'));
    } finally {
      setBalanceBusy(false);
    }
  }

  const total = history ? history.totalInputTokens + history.totalOutputTokens : 0;
  const selectedSeries = history?.models.find(
    (series) => getModelSeriesKey(series) === selectedModelKey,
  ) || history?.models[0];

  return (
    <section id={id} className="settings-card" aria-labelledby="usage-heading">
      <div className="section-heading">
        <div>
          <span className="step">04</span>
          <h2 id="usage-heading">{t('usage.section.title')}</h2>
        </div>
        <span className="badge">
          <ChartLineIcon size={12} />
          {t('usage.section.badge')}
        </span>
      </div>

      <p className="cost-disclaimer">
        {t('usage.disclaimer')}
      </p>

      <div className="usage-total-grid" aria-label={t('usage.totalGrid.aria')}>
        <UsageTotal label={t('usage.total.inputLabel')} value={history?.totalInputTokens || 0} />
        <UsageTotal label={t('usage.total.outputLabel')} value={history?.totalOutputTokens || 0} />
        <UsageTotal label={t('usage.total.totalLabel')} value={total} />
      </div>

      {!history ? (
        <div className="usage-chart-state" role="status">{t('usage.loading')}</div>
      ) : !history.isLedgerAvailable ? (
        <div className="usage-chart-state warning">{t('usage.unavailable')}</div>
      ) : total === 0 ? (
        <div className="usage-chart-state">{t('usage.empty')}</div>
      ) : (
        <div className="model-usage-dashboard">
          <div className="model-usage-toolbar">
            <span>{t('usage.toolbar.label')}</span>
            <div className="model-filter-list" role="group" aria-label={t('usage.modelFilter.aria')}>
              {history.models.map((series) => {
                const key = getModelSeriesKey(series);
                return (
                  <button
                    key={key}
                    type="button"
                    className={key === getModelSeriesKey(selectedSeries) ? 'model-filter active' : 'model-filter'}
                    aria-pressed={key === getModelSeriesKey(selectedSeries)}
                    onClick={() => setSelectedModelKey(key)}
                  >
                    {series.model}
                  </button>
                );
              })}
            </div>
          </div>
          {selectedSeries && (
            <Suspense fallback={<div className="usage-chart-state" role="status">{t('usage.loading')}</div>}>
              <UsageHistoryChart dashboard={history} series={selectedSeries} />
            </Suspense>
          )}
          <div className="model-usage-list" aria-label={t('usage.modelList.aria')}>
            {history.models.map((series) => (
              <div key={getModelSeriesKey(series)}>
                <strong>{series.model}</strong>
                <span>{t('usage.modelList.input', { tokens: formatTokens(series.totalInputTokens) })}</span>
                <span>{t('usage.modelList.output', { tokens: formatTokens(series.totalOutputTokens) })}</span>
                <span>{t('usage.modelList.total', {
                  tokens: formatTokens(series.totalInputTokens + series.totalOutputTokens),
                })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {officialPricing.status === 'available' && (
        <div className="pricing-reference">
          <div>
            <strong>{t('usage.pricing.title', { provider: officialPricing.providerLabel })}</strong>
            <span>
              {t('usage.pricing.summary', {
                input: formatPrice(officialPricing.inputPerMillion),
                output: formatPrice(officialPricing.outputPerMillion),
                date: officialPricing.checkedAt,
              })}
            </span>
          </div>
          <a href={officialPricing.sourceUrl} target="_blank" rel="noreferrer">
            {t('usage.pricing.source')}
            <ExternalLinkIcon size={14} />
          </a>
        </div>
      )}

      {isDeepSeek && (
        <div className="provider-balance">
          <div className="provider-balance-heading">
            <div>
              <CacheIcon size={16} />
              <strong>{t('usage.balance.title')}</strong>
            </div>
            <button
              className="secondary-button compact-button"
              type="button"
              onClick={refreshBalance}
              disabled={balanceBusy}
            >
              <RefreshIcon
                className={balanceBusy ? 'spin' : undefined}
                size={14}
              />
              {balanceBusy ? t('usage.balance.refreshing') : t('usage.balance.refresh')}
            </button>
          </div>
          {providerBalance.status === 'available' ? (
            <>
              <div className="balance-status-row">
                <span className={providerBalance.isAvailable ? 'badge success' : 'badge warning'}>
                  {providerBalance.isAvailable
                    ? t('usage.balance.available')
                    : t('usage.balance.insufficient')}
                </span>
                <span>{t('usage.balance.checkedAt', { date: providerBalance.checkedAt })}</span>
              </div>
              <div className="balance-list">
                {providerBalance.balances.map((balance) => (
                  <div key={balance.currency}>
                    <span>{t('usage.balance.listItem', { currency: balance.currency })}</span>
                    <strong>{balance.currency} {balance.totalBalance}</strong>
                    <small>
                      {t('usage.balance.topupGranted', {
                        topup: balance.toppedUpBalance,
                        granted: balance.grantedBalance,
                      })}
                    </small>
                  </div>
                ))}
              </div>
              <a href={providerBalance.sourceUrl} target="_blank" rel="noreferrer">
                {t('usage.balance.officialLink')}
                <ExternalLinkIcon size={14} />
              </a>
            </>
          ) : (
            <small>{t('usage.balance.notice')}</small>
          )}
        </div>
      )}

      <p className="card-status" role="status">{status}</p>
      <div className="card-actions">
        <button className="danger-text-button" type="button" onClick={clearLedger} disabled={busy}>
          <TrashIcon size={14} />
          {busy ? t('usage.action.processing') : t('usage.action.clear')}
        </button>
      </div>
    </section>
  );
}

interface UsageTotalProps {
  label: string;
  value: number;
}

function UsageTotal({ label, value }: UsageTotalProps) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value.toLocaleString('en-US')}</strong>
    </div>
  );
}

function formatPrice(amount: number): string {
  return `USD ${amount.toLocaleString('en-US', { maximumFractionDigits: 6 })}`;
}

function formatTokens(value: number): string {
  return value.toLocaleString('en-US');
}

function getModelSeriesKey(series: UsageModelSeries | undefined): string {
  return series ? `${series.provider}:${series.model}` : '';
}
