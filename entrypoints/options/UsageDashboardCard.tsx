import { useEffect, useState } from 'react';
import { Activity, ExternalLink, RefreshCw, Trash2, WalletCards } from 'lucide-react';
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
import { UsageHistoryChart } from './UsageHistoryChart';

interface UsageDashboardCardProps {
  baseUrl: string;
  model: string;
  refreshKey: number;
}

export function UsageDashboardCard({ baseUrl, model, refreshKey }: UsageDashboardCardProps) {
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
      setStatus('读取本地 token 用量失败，请重新加载扩展后重试');
    }
  }

  async function clearLedger(): Promise<void> {
    if (!window.confirm('确定清空所有本地用量记录吗？价格与预算配置会保留。')) return;
    setBusy(true);
    setStatus('');
    try {
      const rawResult: unknown = await browser.runtime.sendMessage({
        type: 'CLEAR_USAGE_LEDGER',
      } satisfies RuntimeMessage);
      const result = parseOperationResult(rawResult);
      if (!result.ok) throw new Error(result.message || '清空本地用量失败');
      setStatus(result.message || '本地用量记录已清空');
      await refreshHistory();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '清空本地用量失败');
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
        const result = parseOperationResult(rawBalance);
        throw new Error(result.message || '查询 DeepSeek 余额失败');
      }
      if (balance.status === 'unsupported') {
        throw new Error('请先保存 DeepSeek 官方 API 配置');
      }
      setProviderBalance(balance);
      setStatus('DeepSeek 余额已更新');
    } catch (error) {
      setProviderBalance({ status: 'unsupported' });
      setStatus(error instanceof Error ? error.message : '查询 DeepSeek 余额失败');
    } finally {
      setBalanceBusy(false);
    }
  }

  const total = history ? history.totalInputTokens + history.totalOutputTokens : 0;
  const selectedSeries = history?.models.find(
    (series) => getModelSeriesKey(series) === selectedModelKey,
  ) || history?.models[0];

  return (
    <section className="settings-card" aria-labelledby="usage-heading">
      <div className="section-heading">
        <div>
          <span className="step">04</span>
          <h2 id="usage-heading">Token 用量</h2>
        </div>
        <span className="badge">
          <Activity aria-hidden="true" size={12} strokeWidth={2} />
          最近 60 天
        </span>
      </div>

      <p className="cost-disclaimer">
        只统计 Provider 响应返回的实际输入、输出 token；记录保存在本机并滚动保留最近 60 天，
        不读取或替代厂商账单。
      </p>

      <div className="usage-total-grid" aria-label="最近 60 天 token 汇总">
        <UsageTotal label="输入 token" value={history?.totalInputTokens || 0} />
        <UsageTotal label="输出 token" value={history?.totalOutputTokens || 0} />
        <UsageTotal label="总计 token" value={total} />
      </div>

      {!history ? (
        <div className="usage-chart-state" role="status">正在读取本地用量…</div>
      ) : !history.isLedgerAvailable ? (
        <div className="usage-chart-state warning">本地账本暂时不可用，当前无法展示历史用量。</div>
      ) : total === 0 ? (
        <div className="usage-chart-state">最近 60 天暂无 Provider 返回的 token 用量。</div>
      ) : (
        <div className="model-usage-dashboard">
          <div className="model-usage-toolbar">
            <span>按模型查看每日输入 / 输出</span>
            <div className="model-filter-list" role="group" aria-label="选择用量模型">
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
          {selectedSeries && <UsageHistoryChart dashboard={history} series={selectedSeries} />}
          <div className="model-usage-list" aria-label="各模型最近 60 天 token 汇总">
            {history.models.map((series) => (
              <div key={getModelSeriesKey(series)}>
                <strong>{series.model}</strong>
                <span>输入 {formatTokens(series.totalInputTokens)}</span>
                <span>输出 {formatTokens(series.totalOutputTokens)}</span>
                <span>合计 {formatTokens(series.totalInputTokens + series.totalOutputTokens)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {officialPricing.status === 'available' && (
        <div className="pricing-reference">
          <div>
            <strong>{officialPricing.providerLabel} 官方模型价格</strong>
            <span>
              输入 {formatPrice(officialPricing.inputPerMillion)} · 输出{' '}
              {formatPrice(officialPricing.outputPerMillion)} / 百万 token · 查询于{' '}
              {officialPricing.checkedAt}
            </span>
          </div>
          <a href={officialPricing.sourceUrl} target="_blank" rel="noreferrer">
            核对来源
            <ExternalLink aria-hidden="true" size={13} strokeWidth={2} />
          </a>
        </div>
      )}

      {isDeepSeek && (
        <div className="provider-balance">
          <div className="provider-balance-heading">
            <div>
              <WalletCards aria-hidden="true" size={16} strokeWidth={2} />
              <strong>DeepSeek 账户余额</strong>
            </div>
            <button
              className="secondary-button compact-button"
              type="button"
              onClick={refreshBalance}
              disabled={balanceBusy}
            >
              <RefreshCw
                className={balanceBusy ? 'spin' : undefined}
                aria-hidden="true"
                size={14}
                strokeWidth={2}
              />
              {balanceBusy ? '查询中…' : '查询余额'}
            </button>
          </div>
          {providerBalance.status === 'available' ? (
            <>
              <div className="balance-status-row">
                <span className={providerBalance.isAvailable ? 'badge success' : 'badge warning'}>
                  {providerBalance.isAvailable ? '余额可用' : '余额不足'}
                </span>
                <span>查询于 {providerBalance.checkedAt}</span>
              </div>
              <div className="balance-list">
                {providerBalance.balances.map((balance) => (
                  <div key={balance.currency}>
                    <span>{balance.currency} 可用余额</span>
                    <strong>{balance.currency} {balance.totalBalance}</strong>
                    <small>
                      充值 {balance.toppedUpBalance} · 赠送 {balance.grantedBalance}
                    </small>
                  </div>
                ))}
              </div>
              <a href={providerBalance.sourceUrl} target="_blank" rel="noreferrer">
                官方余额接口
                <ExternalLink aria-hidden="true" size={13} strokeWidth={2} />
              </a>
            </>
          ) : (
            <small>使用当前已保存的 DeepSeek API Key 查询；余额不会写入本地账本。</small>
          )}
        </div>
      )}

      <p className="card-status" role="status">{status}</p>
      <div className="card-actions">
        <button className="danger-text-button" type="button" onClick={clearLedger} disabled={busy}>
          <Trash2 aria-hidden="true" size={14} strokeWidth={2} />
          {busy ? '处理中…' : '清空本地用量'}
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
