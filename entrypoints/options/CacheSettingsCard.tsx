import { useEffect, useState } from 'react';
import { Database, Trash2 } from 'lucide-react';
import type { RuntimeMessage, TranslationCacheDashboard } from '@/src/core/contracts';
import {
  parseOperationResult,
  parseTranslationCacheDashboard,
} from '@/src/core/schemas';

export function CacheSettingsCard() {
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
      setStatus('读取本地翻译缓存失败，请重新加载扩展后重试');
    }
  }

  async function clearCache(): Promise<void> {
    if (!window.confirm('确定清空所有本地译文缓存吗？模型配置和用量账本会保留。')) {
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
        throw new Error(result.message || '清空本地翻译缓存失败');
      }
      setStatus(result.message || '本地翻译缓存已清空');
      await refreshDashboard();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '清空本地翻译缓存失败');
    } finally {
      setBusy(false);
    }
  }

  const percentage = dashboard && dashboard.maxSizeBytes > 0
    ? Math.min((dashboard.sizeBytes / dashboard.maxSizeBytes) * 100, 100)
    : 0;

  return (
    <section className="settings-card" aria-labelledby="cache-heading">
      <div className="section-heading">
        <div>
          <span className="step">06</span>
          <h2 id="cache-heading">本地翻译缓存</h2>
        </div>
        <span className="badge">
          <Database aria-hidden="true" size={12} strokeWidth={2} />
          仅保存在本机
        </span>
      </div>

      <p className="cost-disclaimer">
        相同文本、语言、模型和提示词优先复用本地译文，减少重复等待和模型费用。缓存不包含 API Key 或网页 URL。
      </p>

      <div className="cache-summary" aria-live="polite">
        <div>
          <span>缓存条目</span>
          <strong>{dashboard ? dashboard.entryCount : '读取中…'}</strong>
        </div>
        <div>
          <span>本地占用</span>
          <strong>
            {dashboard
              ? `${formatBytes(dashboard.sizeBytes)} / ${formatBytes(dashboard.maxSizeBytes)}`
              : '读取中…'}
          </strong>
        </div>
        <progress max="100" value={percentage}>{percentage.toFixed(0)}%</progress>
        <small>固定保留 {dashboard?.ttlDays || 30} 天；达到容量上限后优先清理最久未使用的译文。</small>
      </div>

      {dashboard && !dashboard.isAvailable && (
        <p className="cost-warning">本地缓存暂时不可用；翻译仍可继续，但不会复用或保存译文。</p>
      )}
      <p className="card-status" role="status">{status}</p>
      <div className="card-actions">
        <button
          className="danger-text-button"
          type="button"
          onClick={clearCache}
          disabled={busy || dashboard?.isAvailable === false}
        >
          <Trash2 aria-hidden="true" size={14} strokeWidth={2} />
          {busy ? '清理中…' : '清空翻译缓存'}
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
