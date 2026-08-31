import { useEffect, useState } from 'react';
import { DatabaseIcon, TrashIcon } from '@/src/icons';
import type { RuntimeMessage, TranslationCacheDashboard } from '@/src/core/contracts';
import {
  parseOperationResult,
  parseTranslationCacheDashboard,
} from '@/src/core/schemas';
import { useTranslation } from '@/src/i18n';

interface CacheSettingsCardProps {
  /** Optional DOM id, used by sidebar scroll anchors (TD-2026-025 P2). */
  id?: string;
}

export function CacheSettingsCard({ id }: CacheSettingsCardProps = {}) {
  const { t } = useTranslation();
  const [dashboard, setDashboard] = useState<TranslationCacheDashboard | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshDashboard();
  }, []);

  async function refreshDashboard(): Promise<void> {
    try {
      const rawDashboard: unknown = await browser.runtime.sendMessage({
        type: 'GET_TRANSLATION_CACHE_DASHBOARD',
      } satisfies RuntimeMessage);
      setDashboard(parseTranslationCacheDashboard(rawDashboard));
    } catch {
      setStatus(t('cache.status.readFailed'));
    }
  }

  async function clearCache(): Promise<void> {
    if (!window.confirm(t('cache.confirm.clear'))) {
      return;
    }

    setBusy(true);
    setStatus('');
    try {
      const rawResult: unknown = await browser.runtime.sendMessage({
        type: 'CLEAR_TRANSLATION_CACHE',
      } satisfies RuntimeMessage);
      const result = parseOperationResult(rawResult);
      if (!result.ok) {
        throw new Error(result.message || t('cache.status.clearFailed'));
      }
      setStatus(result.message || t('cache.status.cleared'));
      await refreshDashboard();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('cache.status.clearFailed'));
    } finally {
      setBusy(false);
    }
  }

  const percentage = dashboard && dashboard.maxSizeBytes > 0
    ? Math.min((dashboard.sizeBytes / dashboard.maxSizeBytes) * 100, 100)
    : 0;

  return (
    <section id={id} className="settings-card" aria-labelledby="cache-heading">
      <div className="section-heading">
        <div>
          <span className="step">06</span>
          <h2 id="cache-heading">{t('cache.section.title')}</h2>
        </div>
        <span className="badge">
          <DatabaseIcon size={12} />
          {t('cache.section.badge')}
        </span>
      </div>

      <p className="cost-disclaimer">
        {t('cache.disclaimer')}
      </p>

      <div className="cache-summary" aria-live="polite">
        <div>
          <span>{t('cache.summary.entries')}</span>
          <strong>{dashboard ? dashboard.entryCount : t('cache.summary.loading')}</strong>
        </div>
        <div>
          <span>{t('cache.summary.usage')}</span>
          <strong>
            {dashboard
              ? `${formatBytes(dashboard.sizeBytes)} / ${formatBytes(dashboard.maxSizeBytes)}`
              : t('cache.summary.loading')}
          </strong>
        </div>
        <progress max="100" value={percentage}>{percentage.toFixed(0)}%</progress>
        <small>{t('cache.ttlNote', { days: dashboard?.ttlDays || 30 })}</small>
      </div>

      {dashboard && !dashboard.isAvailable && (
        <p className="cost-warning">{t('cache.unavailable')}</p>
      )}
      <p className="card-status" role="status">{status}</p>
      <div className="card-actions">
        <button
          className="danger-text-button"
          type="button"
          onClick={clearCache}
          disabled={busy}
        >
          <TrashIcon size={14} />
          {busy ? t('cache.action.processing') : t('cache.action.clear')}
        </button>
      </div>
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}
