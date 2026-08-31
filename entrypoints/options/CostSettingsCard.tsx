import { useEffect, useState } from 'react';
import { CoinIcon, SaveIcon } from '@/src/icons';
import type { CostDashboard, CostSettings, RuntimeMessage } from '@/src/core/contracts';
import { getLocalDateKey } from '@/src/core/cost';
import { DEFAULT_COST_SETTINGS } from '@/src/core/defaults';
import { parseCostDashboard, parseOperationResult } from '@/src/core/schemas';
import { useTranslation } from '@/src/i18n';

interface CostSettingsCardProps {
  model: string;
  /** Optional DOM id, used by sidebar scroll anchors (TD-2026-025 P2). */
  id?: string;
}

type StatusTone = 'danger' | 'info' | 'success' | 'warning';

export function CostSettingsCard({ model, id }: CostSettingsCardProps) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<CostSettings>(DEFAULT_COST_SETTINGS);
  const [dashboard, setDashboard] = useState<CostDashboard | null>(null);
  const [status, setStatus] = useState('');
  const [statusTone, setStatusTone] = useState<StatusTone>('info');
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
      setStatus(t('cost.status.readFailed'));
      setStatusTone('danger');
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
      setStatus(t('cost.status.priceModelRequired'));
      setStatusTone('warning');
      return;
    }
    if (settings.budget.enabled && settings.budget.dailyLimit <= 0) {
      setStatus(t('cost.status.budgetPositiveRequired'));
      setStatusTone('warning');
      return;
    }

    setBusy(true);
    setStatus('');
    setStatusTone('info');
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
      if (!result.ok) throw new Error();
      setSettings(nextSettings);
      setStatus(t('cost.status.saved'));
      setStatusTone('success');
      await refreshDashboard();
    } catch {
      setStatus(t('cost.status.saveFailed'));
      setStatusTone('danger');
    } finally {
      setBusy(false);
    }
  }

  const today = dashboard?.today;

  return (
    <section id={id} className="settings-card" aria-labelledby="cost-heading">
      <div className="section-heading">
        <div>
          <span className="step">05</span>
          <h2 id="cost-heading">{t('cost.section.title')}</h2>
        </div>
        <span className="badge">
          <CoinIcon size={12} />
          {t('cost.section.optional')}
        </span>
      </div>

      <p className="cost-disclaimer">
        {t('cost.disclaimer')}
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
        {t('cost.price.disclaimer', {
          model: settings.price.model || model || t('cost.price.modelEmpty'),
          date: settings.price.updatedAt,
        })}
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
          <span>{t('cost.budget.dailyLimit', { currency: settings.price.currency })}</span>
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
        className={`td-badge td-badge--${statusTone}`}
        role="status"
        aria-live="polite"
      >
        {status}
      </p>
      <div className="card-actions">
        <button className="secondary-button" type="button" onClick={save} disabled={busy}>
          <SaveIcon size={14} />
          {busy ? t('cost.action.processing') : t('cost.action.save')}
        </button>
      </div>
    </section>
  );
}
