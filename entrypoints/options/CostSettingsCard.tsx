import { useEffect, useState } from 'react';
import { CircleDollarSign, Save } from 'lucide-react';
import type { CostDashboard, CostSettings, RuntimeMessage } from '@/src/core/contracts';
import { getLocalDateKey } from '@/src/core/cost';
import { DEFAULT_COST_SETTINGS } from '@/src/core/defaults';
import { parseCostDashboard, parseOperationResult } from '@/src/core/schemas';
import { t } from '@/src/i18n';

interface CostSettingsCardProps {
  model: string;
}

export function CostSettingsCard({ model }: CostSettingsCardProps) {
  const [settings, setSettings] = useState<CostSettings>(DEFAULT_COST_SETTINGS);
  const [dashboard, setDashboard] = useState<CostDashboard | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshDashboard();
  }, []);

  async function refreshDashboard(): Promise<void> {
    try {
      const rawDashboard: unknown = await browser.runtime.sendMessage({
        type: 'GET_COST_DASHBOARD',
      } satisfies RuntimeMessage);
      const nextDashboard = parseCostDashboard(rawDashboard);
      setDashboard(nextDashboard);
      setSettings(nextDashboard.settings);
    } catch {
      setStatus('读取费用提醒配置失败，请重新加载扩展后重试');
    }
  }

  function updatePrice<K extends keyof CostSettings['price']>(
    key: K,
    value: CostSettings['price'][K],
  ): void {
    setSettings((current) => ({
      ...current,
      price: { ...current.price, [key]: value },
    }));
  }

  function updateBudget<K extends keyof CostSettings['budget']>(
    key: K,
    value: CostSettings['budget'][K],
  ): void {
    setSettings((current) => ({
      ...current,
      budget: { ...current.budget, [key]: value },
    }));
  }

  async function save(): Promise<void> {
    if (settings.price.enabled && !model.trim()) {
      setStatus('请先填写模型名称，再启用该模型的价格估算');
      return;
    }
    if (settings.budget.enabled && settings.budget.dailyLimit <= 0) {
      setStatus('启用每日预算时，预算金额必须大于 0');
      return;
    }

    setBusy(true);
    setStatus('');
    try {
      const nextSettings: CostSettings = {
        ...settings,
        price: {
          ...settings.price,
          model: model.trim(),
          updatedAt: getLocalDateKey(),
          source: 'user',
        },
      };
      const rawResult: unknown = await browser.runtime.sendMessage({
        type: 'SAVE_COST_SETTINGS',
        settings: nextSettings,
      } satisfies RuntimeMessage);
      const result = parseOperationResult(rawResult);
      if (!result.ok) throw new Error(result.message || '保存费用提醒配置失败');
      setSettings(nextSettings);
      setStatus(result.message || '费用提醒配置已保存');
      await refreshDashboard();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '保存费用提醒配置失败');
    } finally {
      setBusy(false);
    }
  }

  const today = dashboard?.today;

  return (
    <section className="settings-card" aria-labelledby="cost-heading">
      <div className="section-heading">
        <div>
          <span className="step">05</span>
          <h2 id="cost-heading">{t('cost.section.title')}</h2>
        </div>
        <span className="badge">
          <CircleDollarSign aria-hidden="true" size={12} strokeWidth={2} />
          可选
        </span>
      </div>

      <p className="cost-disclaimer">
        手动价格只用于翻译前预估与本地预算提醒，不会作为账单金额展示；最终费用以厂商账单为准。
      </p>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={settings.price.enabled}
          onChange={(event) => updatePrice('enabled', event.target.checked)}
        />
        <span>{t('cost.price.enableLabel')}</span>
      </label>

      <div className="cost-grid">
        <label>
          <span>{t('cost.price.currency')}</span>
          <select
            value={settings.price.currency}
            onChange={(event) =>
              updatePrice('currency', event.target.value as CostSettings['price']['currency'])
            }
          >
            <option value="USD">USD</option>
            <option value="CNY">CNY</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <label>
          <span>{t('cost.price.inputPerMillion')}</span>
          <input
            type="number"
            min="0"
            step="0.000001"
            value={settings.price.inputPerMillion}
            onChange={(event) => updatePrice('inputPerMillion', Number(event.target.value))}
          />
        </label>
        <label>
          <span>{t('cost.price.outputPerMillion')}</span>
          <input
            type="number"
            min="0"
            step="0.000001"
            value={settings.price.outputPerMillion}
            onChange={(event) => updatePrice('outputPerMillion', Number(event.target.value))}
          />
        </label>
      </div>
      <small>
        价格由你手动维护，不会从官方查询结果自动写入。绑定模型：
        {settings.price.model || model || '尚未填写'} · 更新于 {settings.price.updatedAt}
      </small>

      <div className="budget-section">
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={settings.budget.enabled}
            onChange={(event) => updateBudget('enabled', event.target.checked)}
          />
          <span>{t('cost.budget.enableLabel')}</span>
        </label>
        <label>
          <span>每日预算（{settings.price.currency}）</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={settings.budget.dailyLimit}
            onChange={(event) => updateBudget('dailyLimit', Number(event.target.value))}
          />
        </label>
        <small>{t('cost.budget.thresholdsNote')}</small>
      </div>

      {today?.budgetEnabled && (
        <div className="today-summary">
          <span>{t('cost.budget.todaySummary')}</span>
          <strong>{today.budgetPercentage.toFixed(0)}%</strong>
          <progress max="100" value={Math.min(today.budgetPercentage, 100)}>
            {today.budgetPercentage.toFixed(0)}%
          </progress>
          <small className="budget-copy">{t('cost.budget.fullyReached')}</small>
        </div>
      )}

      <p
        className={`td-badge ${
          /失败|错误|不能|不可|拒绝/.test(status)
            ? 'td-badge--danger'
            : /警告|注意|未配置/.test(status)
              ? 'td-badge--warning'
              : /成功|已|完成/.test(status)
                ? 'td-badge--success'
                : 'td-badge--info'
        }`}
        role="status"
        aria-live="polite"
      >
        {status}
      </p>
      <div className="card-actions">
        <button className="secondary-button" type="button" onClick={save} disabled={busy}>
          <Save aria-hidden="true" size={14} strokeWidth={2} />
          {busy ? '处理中…' : '保存费用提醒'}
        </button>
      </div>
    </section>
  );
}
